import { GAMES } from '../config/bracket-2026'
import type { BracketGame, Picks, RoundIndex } from '../config/bracketTypes'

export type SeriesCorrectAuditRow = {
  gameId: string
  round: RoundIndex
  winner: string
  correctCount: number
  correctNames: string[]
  totalEntries: number
  correctPercent: number
}

export function buildSeriesCorrectAudit(
  players: ReadonlyArray<{ id: string; name: string; picks: Picks }>,
  results: Picks,
  games: readonly BracketGame[] = GAMES,
): SeriesCorrectAuditRow[] {
  const totalEntries = players.length

  return games.flatMap((game) => {
    const winner = results[game.id] ?? null
    if (winner == null || winner === '') return []

    const correctNames = players
      .filter((player) => player.picks[game.id] === winner)
      .map((player) => player.name)
      .sort((a, b) => a.localeCompare(b))

    return {
      gameId: game.id,
      round: game.round,
      winner,
      correctCount: correctNames.length,
      correctNames,
      totalEntries,
      correctPercent: totalEntries > 0 ? correctNames.length / totalEntries : 0,
    }
  })
}
