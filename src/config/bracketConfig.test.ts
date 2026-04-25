import { describe, expect, it } from 'vitest'
import {
  FINAL_ID,
  GAMES,
  MAX_SCORE,
  R1_IDS,
  R2_IDS,
  R3_IDS,
  allGameIds,
  getGameById,
} from './bracket-2026'

describe('bracket config invariants', () => {
  it('has 15 games and unique ids', () => {
    expect(GAMES).toHaveLength(15)
    const ids = GAMES.map((g) => g.id)
    expect(new Set(ids).size).toBe(15)
  })

  it('allGameIds matches GAMES', () => {
    expect(allGameIds.length).toBe(15)
    expect([...allGameIds].sort()).toEqual([...GAMES.map((g) => g.id)].sort())
  })

  it('round counts: 8+4+2+1', () => {
    const r0 = GAMES.filter((g) => g.round === 0).length
    const r1 = GAMES.filter((g) => g.round === 1).length
    const r2 = GAMES.filter((g) => g.round === 2).length
    const r3 = GAMES.filter((g) => g.round === 3).length
    expect(r0).toBe(8)
    expect(r1).toBe(4)
    expect(r2).toBe(2)
    expect(r3).toBe(1)
  })

  it('R1 id lists only first-round games', () => {
    for (const id of R1_IDS) {
      const g = getGameById(id)
      expect(g?.kind).toBe('r1')
    }
  })

  it('KO game ids are not in R1_IDS', () => {
    const r1 = new Set<string>(R1_IDS)
    const koIds = GAMES.filter((g) => g.kind === 'ko').map((g) => g.id)
    for (const id of koIds) {
      expect(r1.has(id)).toBe(false)
    }
  })

  it('final is g15', () => {
    expect(FINAL_ID).toBe('g15')
    expect(getGameById('g15')?.round).toBe(3)
  })

  it('MAX_SCORE is 32', () => {
    expect(MAX_SCORE).toBe(32)
  })

  it('R2 and R3 id group size', () => {
    expect(R2_IDS).toHaveLength(4)
    expect(R3_IDS).toHaveLength(2)
  })
})
