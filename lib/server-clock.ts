// "Now" for the live widgets, by the server's clock rather than the
// visitor's. The stale banner compares the snapshot's time with now, and the
// Trends grid is laid out back from now: on a machine whose clock is days
// off, a fresh snapshot read as dead and the chart's dots fell off its grid.
// Every /api/* answer carries a `Date` header (the edge stamps it on cached
// answers too), so the gap between it and the local clock is the correction.

// A gap this small is the header's one-second grain plus the answer's time
// on the wire — not a wrong clock. Ignoring it leaves a visitor whose clock
// is right with exactly the local time, as before.
export const SKEW_IGNORED_MS = 120_000

// Milliseconds to add to the local clock. 0 when there is no usable header.
export function clockSkew(dateHeader: string | null, clientNow: number): number {
  if (!dateHeader) return 0
  const server = Date.parse(dateHeader)
  if (!Number.isFinite(server)) return 0
  const skew = server - clientNow
  return Math.abs(skew) < SKEW_IGNORED_MS ? 0 : skew
}

let skew = 0

// Call with each /api/* response; an answer without the header keeps the
// last known correction.
export function noteServerDate(res: Response): void {
  const header = res.headers.get('date')
  if (header) skew = clockSkew(header, Date.now())
}

export function serverNow(): number {
  return Date.now() + skew
}
