/**
 * 2025–26-style Stanley Cup pool bracket (editable per season).
 * R1: eight matchups; R2: four; R3: two; Final: one.
 * Points: R1=1, R2=2, R3=4, Final=8.
 */

import type { BracketGame, Team } from './bracketTypes'

export const POINTS_BY_ROUND: readonly [number, number, number, number] = [
  1, 2, 4, 8,
] as const

const t = (abbr: string, name: string): Team => ({ abbr, name })

/** First round — left (Western) pod */
const R1L: readonly [teamA: Team, teamB: Team][] = [
  [t('COL', 'Avalanche'), t('LAK', 'Kings')],
  [t('DAL', 'Stars'), t('MIN', 'Wild')],
  [t('VGK', 'Golden Knights'), t('UTA', 'Hockey Club')],
  [t('EDM', 'Oilers'), t('ANA', 'Ducks')],
]

/** First round — right (Eastern) pod */
const R1R: readonly [teamA: Team, teamB: Team][] = [
  [t('BUF', 'Sabres'), t('BOS', 'Bruins')],
  [t('TBL', 'Lightning'), t('MTL', 'Canadiens')],
  [t('CAR', 'Hurricanes'), t('OTT', 'Senators')],
  [t('PIT', 'Penguins'), t('PHI', 'Flyers')],
]

export const GAMES: BracketGame[] = [
  {
    kind: 'r1',
    id: 'g1',
    side: 'left',
    indexInRound: 0,
    round: 0,
    top: R1L[0]![0]!,
    bottom: R1L[0]![1]!,
  },
  {
    kind: 'r1',
    id: 'g2',
    side: 'left',
    indexInRound: 1,
    round: 0,
    top: R1L[1]![0]!,
    bottom: R1L[1]![1]!,
  },
  {
    kind: 'r1',
    id: 'g3',
    side: 'left',
    indexInRound: 2,
    round: 0,
    top: R1L[2]![0]!,
    bottom: R1L[2]![1]!,
  },
  {
    kind: 'r1',
    id: 'g4',
    side: 'left',
    indexInRound: 3,
    round: 0,
    top: R1L[3]![0]!,
    bottom: R1L[3]![1]!,
  },
  {
    kind: 'r1',
    id: 'g5',
    side: 'right',
    indexInRound: 0,
    round: 0,
    top: R1R[0]![0]!,
    bottom: R1R[0]![1]!,
  },
  {
    kind: 'r1',
    id: 'g6',
    side: 'right',
    indexInRound: 1,
    round: 0,
    top: R1R[1]![0]!,
    bottom: R1R[1]![1]!,
  },
  {
    kind: 'r1',
    id: 'g7',
    side: 'right',
    indexInRound: 2,
    round: 0,
    top: R1R[2]![0]!,
    bottom: R1R[2]![1]!,
  },
  {
    kind: 'r1',
    id: 'g8',
    side: 'right',
    indexInRound: 3,
    round: 0,
    top: R1R[3]![0]!,
    bottom: R1R[3]![1]!,
  },
  {
    kind: 'ko',
    id: 'g9',
    side: 'left',
    indexInRound: 0,
    round: 1,
    feeds: ['g1', 'g2'],
  },
  {
    kind: 'ko',
    id: 'g10',
    side: 'left',
    indexInRound: 1,
    round: 1,
    feeds: ['g3', 'g4'],
  },
  {
    kind: 'ko',
    id: 'g11',
    side: 'right',
    indexInRound: 0,
    round: 1,
    feeds: ['g5', 'g6'],
  },
  {
    kind: 'ko',
    id: 'g12',
    side: 'right',
    indexInRound: 1,
    round: 1,
    feeds: ['g7', 'g8'],
  },
  {
    kind: 'ko',
    id: 'g13',
    side: 'left',
    indexInRound: 0,
    round: 2,
    feeds: ['g9', 'g10'],
  },
  {
    kind: 'ko',
    id: 'g14',
    side: 'right',
    indexInRound: 0,
    round: 2,
    feeds: ['g11', 'g12'],
  },
  {
    kind: 'ko',
    id: 'g15',
    side: 'final',
    indexInRound: 0,
    round: 3,
    feeds: ['g13', 'g14'],
  },
]

const byId = new Map(GAMES.map((g) => [g.id, g] as const))

export function getGameById(id: string): BracketGame | undefined {
  return byId.get(id)
}

export const allGameIds: readonly string[] = GAMES.map((g) => g.id)

export const R1_IDS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'] as const
export const R2_IDS = ['g9', 'g10', 'g11', 'g12'] as const
export const R3_IDS = ['g13', 'g14'] as const
export const FINAL_ID = 'g15'

/** Sum of (games in round) × (points for round) = 32. */
export const MAX_SCORE = GAMES.reduce(
  (s, g) => s + POINTS_BY_ROUND[g.round],
  0,
)

const _teamByAbbr = new Map<string, Team>()
for (const g of GAMES) {
  if (g.kind === 'r1') {
    _teamByAbbr.set(g.top.abbr, g.top)
    _teamByAbbr.set(g.bottom.abbr, g.bottom)
  }
}
export const teamByAbbr: ReadonlyMap<string, Team> = _teamByAbbr
