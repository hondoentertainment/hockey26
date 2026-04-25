import { describe, expect, it } from 'vitest'
import type { BracketGame } from '../config/bracketTypes'
import { buildSeriesCorrectAudit } from './seriesCorrectAudit'

const games = [
  {
    kind: 'r1',
    id: 'g1',
    side: 'left',
    indexInRound: 0,
    round: 0,
    top: { abbr: 'A', name: 'Team A' },
    bottom: { abbr: 'B', name: 'Team B' },
  },
  {
    kind: 'r1',
    id: 'g2',
    side: 'left',
    indexInRound: 1,
    round: 0,
    top: { abbr: 'C', name: 'Team C' },
    bottom: { abbr: 'D', name: 'Team D' },
  },
] satisfies readonly BracketGame[]

describe('buildSeriesCorrectAudit', () => {
  it('counts and names players who picked each decided series winner', () => {
    const rows = buildSeriesCorrectAudit(
      [
        { id: '1', name: 'Zoe', picks: { g1: 'A', g2: 'C' } },
        { id: '2', name: 'Ana', picks: { g1: 'A', g2: 'D' } },
        { id: '3', name: 'Bo', picks: { g1: 'B', g2: null } },
      ],
      { g1: 'A', g2: 'D' },
      games,
    )

    expect(rows).toEqual([
      {
        gameId: 'g1',
        round: 0,
        winner: 'A',
        correctCount: 2,
        correctNames: ['Ana', 'Zoe'],
        totalEntries: 3,
        correctPercent: 2 / 3,
      },
      {
        gameId: 'g2',
        round: 0,
        winner: 'D',
        correctCount: 1,
        correctNames: ['Ana'],
        totalEntries: 3,
        correctPercent: 1 / 3,
      },
    ])
  })

  it('skips undecided series', () => {
    const rows = buildSeriesCorrectAudit(
      [{ id: '1', name: 'Ana', picks: { g1: 'A', g2: 'D' } }],
      { g1: 'A', g2: null },
      games,
    )

    expect(rows.map((row) => row.gameId)).toEqual(['g1'])
  })
})
