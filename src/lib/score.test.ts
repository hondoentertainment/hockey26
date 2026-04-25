import { describe, expect, it } from 'vitest'
import { GAMES, MAX_SCORE, POINTS_BY_ROUND } from '../config/bracket-2026'
import { scoreBracket } from './score'
import type { Picks } from '../config/bracketTypes'

const fullResults: Picks = {
  g1: 'COL',
  g2: 'DAL',
  g3: 'VGK',
  g4: 'EDM',
  g5: 'BUF',
  g6: 'TBL',
  g7: 'CAR',
  g8: 'PIT',
  g9: 'COL',
  g10: 'VGK',
  g11: 'BUF',
  g12: 'CAR',
  g13: 'COL',
  g14: 'CAR',
  g15: 'COL',
}

describe('scoreBracket', () => {
  it('caps at MAX_SCORE when all picks match results', () => {
    const s = scoreBracket(fullResults, fullResults, GAMES)
    expect(s.total).toBe(MAX_SCORE)
    expect(
      s.byRound[0]! + s.byRound[1]! + s.byRound[2]! + s.byRound[3]!,
    ).toBe(s.total)
  })

  it('MAX_SCORE equals 32 for this 15-game bracket', () => {
    const manual = GAMES.reduce((acc, g) => acc + POINTS_BY_ROUND[g.round], 0)
    expect(manual).toBe(32)
    expect(MAX_SCORE).toBe(32)
  })

  it('returns 0 when there are no official results', () => {
    const picks: Picks = { g1: 'COL' }
    const s = scoreBracket(picks, {}, GAMES)
    expect(s.total).toBe(0)
    expect(s.byRound).toEqual([0, 0, 0, 0])
  })

  it('gives 1 point per correct R1 game only in that round', () => {
    const results: Picks = { g1: 'COL' }
    const s = scoreBracket(
      { g1: 'COL' },
      results,
      GAMES,
    )
    expect(s.total).toBe(1)
    expect(s.byRound[0]).toBe(1)
  })

  it('does not add points for wrong picks in R1', () => {
    const s = scoreBracket({ g1: 'LAK' }, { g1: 'COL' }, GAMES)
    expect(s.total).toBe(0)
  })

  it('partial bracket: 4 correct in R1 only', () => {
    const results: Picks = {
      g1: 'COL',
      g2: 'MIN',
      g3: 'VGK',
      g4: 'ANA',
    }
    const perfectR1: Picks = { ...results }
    const s = scoreBracket(perfectR1, results, GAMES)
    expect(s.total).toBe(4)
    expect(s.byRound[0]).toBe(4)
    expect(s.byRound[1]).toBe(0)
  })
})
