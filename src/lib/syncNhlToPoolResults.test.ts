import { describe, expect, it } from 'vitest'
import type { BracketGame, Team } from '../config/bracketTypes'
import type { NhlPlayoffBracketResponse } from './nhlPlayoffApiTypes'
import {
  buildOfficialResultsFromNhlBracket,
  winnerAbbrFromSeries,
} from './syncNhlToPoolResults'

const mkT = (abbr: string, name: string = ''): Team => ({ abbr, name: name || abbr })

const miniBracket: NhlPlayoffBracketResponse = {
  series: [
    {
      playoffRound: 1,
      topSeedWins: 4,
      bottomSeedWins: 2,
      winningTeamId: 10,
      topSeedTeam: { id: 10, abbrev: 'AAA', name: { default: 'A' } },
      bottomSeedTeam: { id: 20, abbrev: 'BBB', name: { default: 'B' } },
    },
    {
      playoffRound: 1,
      topSeedWins: 3,
      bottomSeedWins: 4,
      winningTeamId: 40,
      topSeedTeam: { id: 30, abbrev: 'CCC', name: { default: 'C' } },
      bottomSeedTeam: { id: 40, abbrev: 'DDD', name: { default: 'D' } },
    },
    {
      playoffRound: 2,
      topSeedWins: 4,
      bottomSeedWins: 2,
      winningTeamId: 10,
      topSeedTeam: { id: 10, abbrev: 'AAA', name: { default: 'A' } },
      bottomSeedTeam: { id: 40, abbrev: 'DDD', name: { default: 'D' } },
    },
  ],
}

const miniGames: BracketGame[] = [
  {
    kind: 'r1',
    id: 'a',
    side: 'left',
    indexInRound: 0,
    round: 0,
    top: mkT('AAA'),
    bottom: mkT('BBB'),
  },
  {
    kind: 'r1',
    id: 'b',
    side: 'left',
    indexInRound: 1,
    round: 0,
    top: mkT('CCC'),
    bottom: mkT('DDD'),
  },
  {
    kind: 'ko',
    id: 'c',
    side: 'left',
    indexInRound: 0,
    round: 1,
    feeds: ['a', 'b'],
  },
]

describe('winnerAbbrFromSeries', () => {
  it('returns null while series is still playing', () => {
    expect(
      winnerAbbrFromSeries({
        playoffRound: 1,
        topSeedWins: 1,
        bottomSeedWins: 0,
        winningTeamId: 0,
        topSeedTeam: { id: 1, abbrev: 'X', name: { default: 'X' } },
        bottomSeedTeam: { id: 2, abbrev: 'Y', name: { default: 'Y' } },
      }),
    ).toBeNull()
  })
})

describe('buildOfficialResultsFromNhlBracket', () => {
  it('maps R1 and a matching later round to pool ids', () => {
    const r = buildOfficialResultsFromNhlBracket(miniBracket, miniGames)
    expect(r['a']).toBe('AAA')
    expect(r['b']).toBe('DDD')
    expect(r['c']).toBe('AAA')
  })
})
