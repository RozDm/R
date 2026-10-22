// Rate-limit identity of a client address. An IPv6 subscriber usually gets a
// whole /64 and can rotate through it at will, so a limit keyed on the full
// address hands out a fresh budget per address; the /64 is the unit one
// client controls. IPv4 (and an IPv4-mapped IPv6 address) stays the address.
// Pure, no Workers globals: tests import it under the app tsconfig.

export function clientKey(ip: string): string {
  const addr = ip.trim().toLowerCase()
  if (!addr.includes(':')) return addr
  const g = expandIpv6(addr)
  if (!g) return addr
  if (g.slice(0, 5).every((x) => x === '0') && g[5] === 'ffff') {
    const n = (parseInt(g[6], 16) << 16) | parseInt(g[7], 16)
    return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  }
  return `${g.slice(0, 4).join(':')}::/64`
}

// The eight 16-bit groups of an IPv6 address with '::' expanded and leading
// zeros dropped, or null if it isn't one. The compressed form can't just be
// split on ':' — '2001:db8::1' would give a different "prefix" for every
// address in the network.
export function expandIpv6(addr: string): string[] | null {
  let s = addr
  // A dotted IPv4 tail (::ffff:192.0.2.1, 64:ff9b::192.0.2.1) is two groups.
  const v4 = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const o = v4.slice(2).map(Number)
    if (o.some((n) => n > 255)) return null
    s = `${v4[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (!groups.every((x) => /^[0-9a-f]{1,4}$/.test(x))) return null
  return groups.map((x) => parseInt(x, 16).toString(16))
}
