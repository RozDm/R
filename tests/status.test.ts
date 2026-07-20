import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, buildStatusData, detectTransitions, parseHistory } from '@/src/status'
import type { HistoryEntry, MonitorResult } from '@/src/status'

const result = (name: string, ok: boolean): MonitorResult => ({
  name,
  url: `https://${name}.test/`,
  ok,
  status: ok ? 200 : 0,
  ms: 42,
})

describe('buildStatusData', () => {
  it('starts an empty history when KV is empty', () => {
    const data = buildStatusData(null, [result('A', true)], '2026-01-01T00:00:00Z')
    expect(data.history).toHaveLength(1)
    expect(data.history[0]).toEqual({ at: '2026-01-01T00:00:00Z', up: { A: true } })
    expect(data.results).toHaveLength(1)
    expect(data.updatedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('appends to existing per-service history', () => {
    const raw = JSON.stringify({
      updatedAt: '2026-01-01T00:00:00Z',
      results: [],
      history: [{ at: '2026-01-01T00:00:00Z', up: { A: true } }],
    })
    const data = buildStatusData(raw, [result('A', false)], '2026-01-01T00:05:00Z')
    expect(data.history).toHaveLength(2)
    expect(data.history[1].up).toEqual({ A: false })
  })

  it('drops legacy aggregated history entries (up: boolean)', () => {
    const raw = JSON.stringify({
      history: [
        { at: '2026-01-01T00:00:00Z', up: true },
        { at: '2026-01-01T00:05:00Z', up: false },
      ],
    })
    const data = buildStatusData(raw, [result('A', true)], '2026-01-01T00:10:00Z')
    expect(data.history).toHaveLength(1)
    expect(data.history[0].up).toEqual({ A: true })
  })

  it('survives malformed KV JSON', () => {
    const data = buildStatusData('not json {{{', [result('A', true)], '2026-01-01T00:00:00Z')
    expect(data.history).toHaveLength(1)
  })

  it('caps history at HISTORY_LIMIT entries', () => {
    const longHistory: HistoryEntry[] = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      at: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`,
      up: { A: true },
    }))
    const raw = JSON.stringify({ history: longHistory })
    const data = buildStatusData(raw, [result('A', false)], '2026-06-01T00:00:00Z')
    expect(data.history).toHaveLength(HISTORY_LIMIT)
    expect(data.history[data.history.length - 1].up).toEqual({ A: false })
  })

  it('records up/down per monitor when multiple are present', () => {
    const data = buildStatusData(null, [result('A', true), result('B', false)], '2026-01-01T00:00:00Z')
    expect(data.history[0].up).toEqual({ A: true, B: false })
  })
})

describe('parseHistory', () => {
  it('returns [] for null, empty, malformed, and legacy entries', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory('not json {{{')).toEqual([])
    expect(parseHistory(JSON.stringify({ history: [{ at: '2026-01-01T00:00:00Z', up: true }] }))).toEqual([])
  })

  it('keeps only well-formed entries', () => {
    const raw = JSON.stringify({
      history: [
        { at: '2026-01-01T00:00:00Z', up: { A: true } },
        { at: 'x', up: null },
      ],
    })
    expect(parseHistory(raw)).toEqual([{ at: '2026-01-01T00:00:00Z', up: { A: true } }])
  })
})

describe('detectTransitions', () => {
  // Shorthand: history entries where A's probe results are the given booleans.
  const historyOf = (...probes: boolean[]): HistoryEntry[] =>
    probes.map((up, i) => ({ at: `2026-01-01T00:${String(i * 5).padStart(2, '0')}:00Z`, up: { A: up } }))

  it('emits nothing on a first-ever run (no previous history)', () => {
    expect(detectTransitions([], [result('A', true), result('A', false)])).toEqual([])
  })

  it('emits nothing for a new monitor missing from all previous ticks', () => {
    const prev = historyOf(true)
    expect(detectTransitions(prev, [result('A', true), result('B', false)]).map((r) => r.name)).toEqual([])
  })

  it('emits nothing when the alerted state is unchanged', () => {
    // A steadily up, B already alerted down (two failed probes in history).
    const prev: HistoryEntry[] = [
      { at: '2026-01-01T00:00:00Z', up: { A: true, B: false } },
      { at: '2026-01-01T00:05:00Z', up: { A: true, B: false } },
    ]
    expect(detectTransitions(prev, [result('A', true), result('B', false)])).toEqual([])
  })

  it('damps a single failed probe (no down alert yet)', () => {
    expect(detectTransitions(historyOf(true), [result('A', false)])).toEqual([])
  })

  it('alerts down on the second consecutive failed probe', () => {
    const out = detectTransitions(historyOf(true, false), [result('A', false)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'A', ok: false })
  })

  it('does not repeat the down alert while the outage continues', () => {
    expect(detectTransitions(historyOf(true, false, false), [result('A', false)])).toEqual([])
  })

  it('stays silent when a blip recovers within one tick', () => {
    // Down for one probe, up again: neither «nede» nor «oppe igjen» fired.
    expect(detectTransitions(historyOf(true, false), [result('A', true)])).toEqual([])
  })

  it('alerts recovery on the first success after an alerted outage', () => {
    const out = detectTransitions(historyOf(true, false, false), [result('A', true)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'A', ok: true })
  })

  it('needs two fresh consecutive fails after a recovery', () => {
    // An old outage followed by an up tick resets the damping window.
    expect(detectTransitions(historyOf(false, false, true), [result('A', false)])).toEqual([])
    const out = detectTransitions(historyOf(false, false, true, false), [result('A', false)])
    expect(out).toHaveLength(1)
    expect(out[0].ok).toBe(false)
  })

  it('ignores entries that lack the monitor when building its series', () => {
    // A's series across the gap is [true, false]; the B-only tick between
    // them must not reset A's damping window.
    const prev: HistoryEntry[] = [
      { at: '2026-01-01T00:00:00Z', up: { A: true } },
      { at: '2026-01-01T00:05:00Z', up: { B: true } },
      { at: '2026-01-01T00:10:00Z', up: { A: false, B: true } },
    ]
    const out = detectTransitions(prev, [result('A', false)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'A', ok: false })
  })
})
