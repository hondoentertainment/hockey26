import { GAMES } from '../config/bracket-2026'
import type { Picks } from '../config/bracketTypes'
import { scoreBracket } from './score'

type ScoreR = ReturnType<typeof scoreBracket>

export type RankedPlayer = {
  id: string
  name: string
  /** 1 = best; same score = same rank. */
  rank: number
} & ScoreR

/**
 * Ranks all pool rows by `scoreBracket(p.picks, results)`.
 * Rank = 1 + number of players with a strictly higher total.
 */
export function buildLeaderboard(
  players: ReadonlyArray<{ id: string; name: string; picks: Picks }>,
  results: Picks,
  games = GAMES,
): RankedPlayer[] {
  const scored = players.map((p) => ({
    id: p.id,
    name: p.name,
    ...scoreBracket(p.picks, results, games),
  }))
  return scored
    .map((p) => ({
      ...p,
      rank: 1 + scored.filter((x) => x.total > p.total).length,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.name.localeCompare(b.name)
    })
}
