import { describe, expect, it } from 'vitest'
import { buildLeaderboard } from './rankings'

describe('buildLeaderboard', () => {
  it('ranks by total and uses competition rank for ties', () => {
    const p = buildLeaderboard(
      [
        {
          id: 'a',
          name: 'A',
          picks: { g1: 'X' },
        },
        {
          id: 'b',
          name: 'B',
          picks: { g1: 'X' },
        },
        { id: 'c', name: 'C', picks: { g1: 'Y' } },
      ],
      { g1: 'X' },
    )
    expect(p[0]!.name).toBe('A')
    expect(p[0]!.total).toBe(1)
    expect(p[0]!.rank).toBe(1)
    expect(p[1]!.name).toBe('B')
    expect(p[1]!.total).toBe(1)
    expect(p[1]!.rank).toBe(1)
    expect(p[2]!.name).toBe('C')
    expect(p[2]!.total).toBe(0)
    expect(p[2]!.rank).toBe(3)
  })
})
