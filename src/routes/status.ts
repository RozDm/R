// GET /api/status — serve the latest uptime snapshot from KV.
import { apiJson } from '../http'
import { STATUS_KEY } from '../status'

export async function handleStatus(url: URL, env: Env): Promise<Response | null> {
  if (url.pathname !== '/api/status') return null
  let body = '{"results":[],"history":[]}'
  try {
    body = (await env.STATUS.get(STATUS_KEY)) || body
  } catch {}
  return apiJson(body)
}
