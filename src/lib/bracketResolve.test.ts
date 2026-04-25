import { describe, expect, it } from 'vitest'
import { GAMES, getGameById } from '../config/bracket-2026'
import type { Picks } from '../config/bracketTypes'
import {
  coerceOfficialResultsByFeeds,
  dependentGameIds,
  getSlotTeams,
} from './bracketResolve'

describe('getSlotTeams', () => {
  it('returns fixed teams for first round', () => {
    const g = getGameById('g1')
    expect(g?.kind).toBe('r1')
    if (!g || g.kind !== 'r1') return
    const s = getSlotTeams(g, {})
    expect(s.top?.abbr).toBe('COL')
    expect(s.bottom?.abbr).toBe('LAK')
  })

  it('resolves KO slots from child winners in state', () => {
    const g = getGameById('g9')
    if (!g || g.kind !== 'ko') return
    const state: Picks = { g1: 'COL', g2: 'DAL' }
    const s = getSlotTeams(g, state)
    expect(s.top?.abbr).toBe('COL')
    expect(s.bottom?.abbr).toBe('DAL')
  })

  it('returns null for bottom KO slot if sibling child not picked', () => {
    const g = getGameById('g9')
    if (!g || g.kind !== 'ko') return
    const s = getSlotTeams(g, { g1: 'COL' })
    expect(s.top?.abbr).toBe('COL')
    expect(s.bottom).toBeNull()
  })
})

describe('coerceOfficialResultsByFeeds', () => {
  it('clears downstream KOs when a feeder winner is missing', () => {
    const r: Picks = {
      g1: 'COL',
      g2: null,
      g9: 'COL',
      g13: 'COL',
      g15: 'COL',
    }
    const out = coerceOfficialResultsByFeeds(r, GAMES)
    expect(out.g2).toBeNull()
    expect(out.g9).toBeNull()
    expect(out.g13).toBeNull()
    expect(out.g15).toBeNull()
    expect(out.g1).toBe('COL')
  })
})

describe('dependentGameIds', () => {
  it('includes downstream chain g1 → g9 → g13 → g15', () => {
    const d = dependentGameIds(GAMES, ['g1'])
    expect(d.has('g9')).toBe(true)
    expect(d.has('g13')).toBe(true)
    expect(d.has('g15')).toBe(true)
  })

  it('does not include g1 in dependents of itself', () => {
    const d = dependentGameIds(GAMES, ['g1'])
    expect(d.has('g1')).toBe(false)
  })

  it('returns empty if nothing feeds from changed id', () => {
    const d = dependentGameIds(GAMES, ['g15'])
    expect(d.size).toBe(0)
  })
})
