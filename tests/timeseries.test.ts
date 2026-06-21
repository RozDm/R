import { describe, expect, it } from 'vitest'
import { buildSeriesSql, parseMetric, parseRange, parseSeriesResponse } from '@/src/timeseries'

describe('parseMetric', () => {
  it('accepts the two supported metrics', () => {
    expect(parseMetric('view')).toBe('view')
    expect(parseMetric('geo')).toBe('geo')
  })

  it('rejects everything else, including null', () => {
    expect(parseMetric('VIEW')).toBeNull()
    expect(parseMetric('contact')).toBeNull()
    expect(parseMetric('')).toBeNull()
    expect(parseMetric(null)).toBeNull()
  })
})

describe('parseRange', () => {
  it('returns the requested known range', () => {
    expect(parseRange('24h').key).toBe('24h')
    expect(parseRange('7d').key).toBe('7d')
    expect(parseRange('30d').key).toBe('30d')
  })

  it('falls back to 7d on unknown or missing input', () => {
    expect(parseRange(null).key).toBe('7d')
    expect(parseRange('garbage').key).toBe('7d')
    expect(parseRange('__proto__').key).toBe('7d')
  })
})

describe('buildSeriesSql', () => {
  it('embeds the metric literal in the WHERE clause', () => {
    const sql = buildSeriesSql('ds', 'view', parseRange('7d').range)
    expect(sql).toContain("blob1 = 'view'")
    expect(sql).toContain('FROM ds')
    expect(sql).toContain('FORMAT JSON')
  })

  it('uses different bucket sizes per range', () => {
    expect(buildSeriesSql('ds', 'geo', parseRange('24h').range)).toContain('toStartOfHour')
    expect(buildSeriesSql('ds', 'geo', parseRange('30d').range)).toContain('toStartOfInterval')
  })

  it('does not embed an epoch floor in the SQL itself (filter is client-side, see parseSeriesResponse)', () => {
    const sql = buildSeriesSql('ds', 'geo', parseRange('7d').range)
    expect(sql).not.toContain('toDateTime')
    expect(sql).not.toContain('CAST')
  })

  // AE's SQL parser rejects bare INTERVAL N UNIT — it wants a string literal,
  // INTERVAL 'N' UNIT. We had `INTERVAL 6 HOUR` in 30d's bucket clause and the
  // chart silently went blank with a 422 from AE. Pin the quoted form for
  // every range so a future tweak can't drop the quotes again.
  it("quotes every INTERVAL literal (AE rejects bare INTERVAL N UNIT)", () => {
    for (const key of ['24h', '7d', '30d'] as const) {
      const sql = buildSeriesSql('ds', 'geo', parseRange(key).range)
      expect(sql).not.toMatch(/INTERVAL\s+\d/)
      expect(sql).toMatch(/INTERVAL\s+'\d+'/)
    }
  })
})

describe('parseSeriesResponse', () => {
  it('extracts the [{ts, value}] points', () => {
    const payload = {
      data: [
        { ts: '2026-06-19T00:00:00Z', value: 3 },
        { ts: '2026-06-19T01:00:00Z', value: 7 },
      ],
    }
    expect(parseSeriesResponse(payload, '')).toEqual([
      { ts: '2026-06-19T00:00:00Z', value: 3 },
      { ts: '2026-06-19T01:00:00Z', value: 7 },
    ])
  })

  it('coerces stringy numbers (AE sometimes serialises SUMs as strings)', () => {
    expect(parseSeriesResponse({ data: [{ ts: 'x', value: '5' }] }, '')).toEqual([{ ts: 'x', value: 5 }])
  })

  it('drops malformed rows', () => {
    expect(
      parseSeriesResponse(
        {
          data: [
            { ts: 'x', value: 1 },
            { ts: 2, value: 3 },
            { ts: 'y', value: -1 },
            { ts: 'z', value: 'NaN' },
          ],
        },
        '',
      ),
    ).toEqual([{ ts: 'x', value: 1 }])
  })

  it('returns [] on garbage input', () => {
    expect(parseSeriesResponse(null, '')).toEqual([])
    expect(parseSeriesResponse({}, '')).toEqual([])
    expect(parseSeriesResponse({ data: 'no' }, '')).toEqual([])
  })

  it('drops rows older than the epoch (AE keeps pre-relaunch points; we hide them here)', () => {
    const out = parseSeriesResponse(
      {
        data: [
          { ts: '2026-06-19 10:00:00', value: 5 },
          { ts: '2026-06-20 17:15:00', value: 3 },
          { ts: '2026-06-20 18:00:00', value: 7 },
        ],
      },
      '2026-06-20 17:15:00',
    )
    expect(out).toEqual([
      { ts: '2026-06-20 17:15:00', value: 3 },
      { ts: '2026-06-20 18:00:00', value: 7 },
    ])
  })

  it('passes everything through when epoch is the empty string', () => {
    const out = parseSeriesResponse(
      { data: [{ ts: '1900-01-01 00:00:00', value: 1 }] },
      '',
    )
    expect(out).toHaveLength(1)
  })
})
