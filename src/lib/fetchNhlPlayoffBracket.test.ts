import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNhlPlayoffBracket } from './fetchNhlPlayoffBracket'

const sample = { series: [{ playoffRound: 1, topSeedWins: 0, bottomSeedWins: 0 }] }

describe('fetchNhlPlayoffBracket', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sample,
        headers: { get: () => 'application/json' },
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  })

  it('returns JSON when fetch succeeds', async () => {
    const data = await fetchNhlPlayoffBracket(2026)
    expect(data.series).toEqual(sample.series)
    expect(fetch).toHaveBeenCalled()
  })

  it('throws when all URLs fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Err' }),
    )
    await expect(fetchNhlPlayoffBracket(1999)).rejects.toThrow(/NHL bracket unavailable/)
  })
})
