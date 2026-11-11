#!/usr/bin/env node
// Webhuset (the registrar) on demand, through its MCP endpoint. The server used
// to be attached to every session (.mcp.json): its instructions and 50 tool
// names cost ~1.5k tokens of context each time, for a few DNS or registry
// look-ups a year. The key is read-only.
//
//   node scripts/webhuset.mjs list [filter]    the tools, one line each
//   node scripts/webhuset.mjs <tool> ['<json arguments>']
//
// Cloud sessions: the environment's network secret for mcp.webhuset.no
// authenticates — the agent proxy injects it, which is why this goes through
// curl (it honours HTTPS_PROXY; Node's fetch doesn't). Elsewhere:
// WEBHUSET_API_KEY=<key>.
import { execFileSync } from 'node:child_process'

const ENDPOINT = 'https://mcp.webhuset.no/mcp/v1'

// One JSON-RPC message. The headers go in on stdin, so a key never shows in
// the process list; the body holds no secret.
function send(message, session, method = 'POST') {
  const headers = [
    'content-type: application/json',
    'accept: application/json, text/event-stream',
    ...(process.env.WEBHUSET_API_KEY ? [`authorization: Bearer ${process.env.WEBHUSET_API_KEY}`] : []),
    ...(session ? [`mcp-session-id: ${session}`] : []),
  ]
  const args = ['-sS', '--max-time', '60', '-X', method, '-D', '-', '-H', '@-']
  if (message) args.push('--data-raw', JSON.stringify({ jsonrpc: '2.0', ...message }))
  let rest = execFileSync('curl', [...args, ENDPOINT], {
    input: `${headers.join('\n')}\n`,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  // Header blocks first: the proxy's "200 Connection Established", then the
  // server's own.
  let head = ''
  while (/^HTTP\/\S+ \d{3}/.test(rest)) {
    const end = rest.search(/\r?\n\r?\n/)
    head = end < 0 ? rest : rest.slice(0, end)
    rest = end < 0 ? '' : rest.slice(end).replace(/^(\r?\n){2}/, '')
  }
  const status = Number(head.match(/^HTTP\/\S+ (\d{3})/)?.[1])
  if (status === 401 || status === 403) {
    throw new Error(`HTTP ${status}: no key — set WEBHUSET_API_KEY (a cloud session takes it from the environment's network secret)`)
  }
  // The body is JSON, or an event stream with the JSON in its data lines.
  const payloads = /^data:/m.test(rest)
    ? rest.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5))
    : [rest]
  const replies = payloads.filter((p) => p.trim()).map((p) => JSON.parse(p))
  const reply = replies.find((r) => r.id === message?.id) ?? replies.find((r) => r.error)
  if (reply?.error) throw new Error(`${reply.error.code}: ${reply.error.message}`)
  if (message?.id !== undefined && !reply) throw new Error(`HTTP ${status}: no reply to ${message.method}`)
  return { result: reply?.result, session: head.match(/^mcp-session-id:\s*(\S+)/im)?.[1] }
}

function main([tool = 'list', arg]) {
  const { session } = send({
    id: 0,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-cli', version: '1' } },
  })
  try {
    send({ method: 'notifications/initialized' }, session)
    if (tool === 'list') {
      const filter = (arg ?? '').toLowerCase()
      for (let cursor, page = 1; page === 1 || cursor; page++) {
        const { result } = send({ id: page, method: 'tools/list', params: cursor ? { cursor } : {} }, session)
        for (const t of result.tools) {
          if (!`${t.name} ${t.description}`.toLowerCase().includes(filter)) continue
          const required = new Set(t.inputSchema?.required ?? [])
          const params = Object.keys(t.inputSchema?.properties ?? {}).map((k) => (required.has(k) ? k : `${k}?`))
          console.log(`${t.name}(${params.join(', ')}) — ${(t.description ?? '').split(/(?<=\.)\s|\n/)[0]}`)
        }
        cursor = result.nextCursor
      }
      return 0
    }
    const { result } = send(
      { id: 1, method: 'tools/call', params: { name: tool, arguments: arg ? JSON.parse(arg) : {} } },
      session,
    )
    for (const part of result.content ?? []) console.log(part.type === 'text' ? part.text : JSON.stringify(part))
    return result.isError ? 1 : 0
  } finally {
    try {
      send(null, session, 'DELETE')
    } catch {
      // Ending the server-side session is a courtesy; nothing depends on it.
    }
  }
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (err) {
  console.error(`webhuset: ${err.message}`)
  process.exitCode = 1
}
