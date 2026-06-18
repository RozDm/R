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
  it('emits nothing on a first-ever run (no previous history)', () => {
    expect(detectTransitions([], [result('A', true), result('A', false)])).toEqual([])
  })

  it('emits nothing for a new monitor missing from the previous tick', () => {
    const prev: HistoryEntry[] = [{ at: '2026-01-01T00:00:00Z', up: { A: true } }]
    expect(detectTransitions(prev, [result('A', true), result('B', false)]).map((r) => r.name)).toEqual([])
  })

  it('emits nothing when state is unchanged', () => {
    const prev: HistoryEntry[] = [{ at: '2026-01-01T00:00:00Z', up: { A: true, B: false } }]
    expect(detectTransitions(prev, [result('A', true), result('B', false)])).toEqual([])
  })

  it('emits a down -> up recovery', () => {
    const prev: HistoryEntry[] = [{ at: '2026-01-01T00:00:00Z', up: { A: false } }]
    const out = detectTransitions(prev, [result('A', true)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'A', ok: true })
  })

  it('emits an up -> down incident', () => {
    const prev: HistoryEntry[] = [{ at: '2026-01-01T00:00:00Z', up: { A: true } }]
    const out = detectTransitions(prev, [result('A', false)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'A', ok: false })
  })

  it('only compares against the most recent entry', () => {
    // Two ticks ago A was down, last tick it was up — only "last tick" counts,
    // so a current down-state is a fresh transition.
    const prev: HistoryEntry[] = [
      { at: '2026-01-01T00:00:00Z', up: { A: false } },
      { at: '2026-01-01T00:05:00Z', up: { A: true } },
    ]
    const out = detectTransitions(prev, [result('A', false)])
    expect(out).toHaveLength(1)
    expect(out[0].ok).toBe(false)
  })
})
