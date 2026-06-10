import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, buildStatusData } from '@/src/status'
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
