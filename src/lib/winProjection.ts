import { GAMES } from '../config/bracket-2026'
import type { BracketGame, Picks } from '../config/bracketTypes'
import { scoreBracket } from './score'

export type WinProjectionRow = {
  id: string
  name: string
  /** Current points from decided series only. */
  total: number
  /** Competition rank by current points (1 = leader; ties share a rank). */
  rank: number
  /** Probability of finishing 1st across all remaining outcomes (0..1). */
  championPct: number
  /** Number of series with an official winner so far. */
  decidedPicks: number
  /** Decided series this entry called correctly. */
  correctPicks: number
  /** correctPicks / decidedPicks (0 when nothing is decided yet). */
  pickAccuracy: number
}

type PlayerInput = { id: string; name: string; picks: Picks }

function isDecided(v: string | null | undefined): v is string {
  return v != null && v !== ''
}

/**
 * The two team abbreviations competing in `game` given current state, or null
 * if a feeder is not yet resolved. A knockout slot is filled by the winner
 * abbreviation already recorded for each feeder game.
 */
function slotAbbrs(game: BracketGame, state: Picks): [string, string] | null {
  if (game.kind === 'r1') return [game.top.abbr, game.bottom.abbr]
  const [a, b] = game.feeds
  const wa = state[a]
  const wb = state[b]
  if (!isDecided(wa) || !isDecided(wb)) return null
  return [wa, wb]
}

/**
 * Enumerate every way the remaining undecided series can finish and invoke
 * `visit` once per complete bracket. `GAMES` is topologically ordered, so the
 * earliest undecided game always has both feeders resolved; resolving it first
 * keeps the recursion valid. With 15 games the tree is at most 2^15 leaves.
 */
function forEachScenario(
  base: Picks,
  games: readonly BracketGame[],
  visit: (full: Picks) => void,
): void {
  const work: Picks = { ...base }
  const rec = (): void => {
    const next = games.find((g) => !isDecided(work[g.id]))
    if (!next) {
      visit(work)
      return
    }
    const teams = slotAbbrs(next, work)
    if (!teams) {
      // Unresolvable feeder (should not happen for the earliest undecided game).
      visit(work)
      return
    }
    for (const w of teams) {
      work[next.id] = w
      rec()
    }
    work[next.id] = null
  }
  rec()
}

/**
 * Projects each entry's chance to win the pool by enumerating every remaining
 * series outcome as a coin flip, plus a pick-accuracy rate over decided series.
 * Ties for the lead in a scenario split the win credit so championPct sums to 1.
 */
export function buildWinProjection(
  players: readonly PlayerInput[],
  results: Picks,
  games: readonly BracketGame[] = GAMES,
): WinProjectionRow[] {
  const scored = players.map((p) => ({
    id: p.id,
    name: p.name,
    picks: p.picks,
    total: scoreBracket(p.picks, results, games).total,
  }))

  const decidedIds = games
    .filter((g) => isDecided(results[g.id]))
    .map((g) => g.id)

  const winShare = new Map<string, number>()
  for (const p of players) winShare.set(p.id, 0)

  let scenarioCount = 0
  forEachScenario(results, games, (full) => {
    scenarioCount++
    let max = -Infinity
    const totals = scored.map((p) => {
      const t = scoreBracket(p.picks, full, games).total
      if (t > max) max = t
      return t
    })
    const leaderIds = scored
      .filter((_, i) => totals[i] === max)
      .map((p) => p.id)
    const credit = 1 / leaderIds.length
    for (const id of leaderIds) {
      winShare.set(id, (winShare.get(id) ?? 0) + credit)
    }
  })

  const rows: WinProjectionRow[] = scored.map((p) => {
    const correctPicks = decidedIds.reduce(
      (n, id) => n + ((p.picks[id] ?? null) === results[id] ? 1 : 0),
      0,
    )
    return {
      id: p.id,
      name: p.name,
      total: p.total,
      rank: 1 + scored.filter((x) => x.total > p.total).length,
      championPct: scenarioCount > 0 ? (winShare.get(p.id) ?? 0) / scenarioCount : 0,
      decidedPicks: decidedIds.length,
      correctPicks,
      pickAccuracy: decidedIds.length > 0 ? correctPicks / decidedIds.length : 0,
    }
  })

  return rows.sort((a, b) => {
    if (b.championPct !== a.championPct) return b.championPct - a.championPct
    if (b.total !== a.total) return b.total - a.total
    return a.name.localeCompare(b.name)
  })
}
