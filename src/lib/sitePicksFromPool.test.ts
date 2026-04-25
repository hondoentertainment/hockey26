import { describe, expect, it } from 'vitest'
import { getSitePicksSource } from './sitePicksFromPool'

describe('getSitePicksSource', () => {
  it('uses first player when defaultPicksPlayerId is absent', () => {
    const r = getSitePicksSource({
      players: [
        { id: '1', name: 'A', picks: { g1: 'X' } },
        { id: '2', name: 'B', picks: { g1: 'Y' } },
      ],
    })
    expect(r.name).toBe('A')
    expect(r.picks.g1).toBe('X')
  })

  it('uses defaultPicksPlayerId when set', () => {
    const r = getSitePicksSource({
      defaultPicksPlayerId: '2',
      players: [
        { id: '1', name: 'A', picks: { g1: 'X' } },
        { id: '2', name: 'B', picks: { g1: 'Y' } },
      ],
    })
    expect(r.name).toBe('B')
    expect(r.picks.g1).toBe('Y')
  })

  it('falls back to first when id is unknown', () => {
    const r = getSitePicksSource({
      defaultPicksPlayerId: 'missing',
      players: [{ id: '1', name: 'A', picks: { g1: 'X' } }],
    })
    expect(r.name).toBe('A')
  })
})
