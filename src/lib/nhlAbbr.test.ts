import { describe, expect, it } from 'vitest'
import { normalizePoolAbbr, teamPairKey } from './nhlAbbr'

describe('normalizePoolAbbr', () => {
  it('maps UTH and UHC to UTA', () => {
    expect(normalizePoolAbbr('UTH')).toBe('UTA')
    expect(normalizePoolAbbr('UHC')).toBe('UTA')
    expect(normalizePoolAbbr('uta')).toBe('UTA')
  })

  it('passes through known three-letter codes', () => {
    expect(normalizePoolAbbr('col')).toBe('COL')
  })
})

describe('teamPairKey', () => {
  it('is order-independent', () => {
    expect(teamPairKey('COL', 'LAK')).toBe(teamPairKey('LAK', 'COL'))
  })
})
