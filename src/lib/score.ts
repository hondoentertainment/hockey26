import {
  GAMES,
  MAX_SCORE,
  POINTS_BY_ROUND,
} from '../config/bracket-2026'
import type { BracketGame, Picks } from '../config/bracketTypes'

export function scoreBracket(
  picks: Picks,
  results: Picks,
  games: readonly BracketGame[] = GAMES,
): {
  total: number
  byRound: readonly [number, number, number, number]
} {
  const byRound: [number, number, number, number] = [0, 0, 0, 0]
  let total = 0
  for (const g of games) {
    const pid = picks[g.id] ?? null
    const rid = results[g.id] ?? null
    if (rid == null || rid === '') continue
    if (pid != null && pid === rid) {
      const pts = POINTS_BY_ROUND[g.round]
      total += pts
      byRound[g.round] += pts
    }
  }
  return { total, byRound }
}

export { MAX_SCORE, POINTS_BY_ROUND }
