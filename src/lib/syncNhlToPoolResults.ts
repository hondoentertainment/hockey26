import { GAMES } from '../config/bracket-2026'
import type { BracketGame, Picks } from '../config/bracketTypes'
import { normalizePoolAbbr, teamPairKey } from './nhlAbbr'
import type {
  NhlPlayoffBracketResponse,
  NhlPlayoffSeries,
} from './nhlPlayoffApiTypes'

function buildSeriesByRoundAndPair(
  data: NhlPlayoffBracketResponse,
): Map<string, NhlPlayoffSeries> {
  const m = new Map<string, NhlPlayoffSeries>()
  for (const s of data.series) {
    if (s == null) continue
    if (!s.topSeedTeam?.abbrev || !s.bottomSeedTeam?.abbrev) continue
    const k = `${s.playoffRound}|${teamPairKey(s.topSeedTeam.abbrev, s.bottomSeedTeam.abbrev)}`
    m.set(k, s)
  }
  return m
}

/**
 * Infers the winner from official series data. Returns null if the series is
 * not decided.
 */
export function winnerAbbrFromSeries(s: NhlPlayoffSeries): string | null {
  if (s.topSeedWins < 4 && s.bottomSeedWins < 4) {
    return null
  }
  const w = s.winningTeamId
  if (w != null && w !== 0) {
    if (s.topSeedTeam.id === w) return normalizePoolAbbr(s.topSeedTeam.abbrev)
    if (s.bottomSeedTeam.id === w) return normalizePoolAbbr(s.bottomSeedTeam.abbrev)
  }
  if (s.topSeedWins === 4) return normalizePoolAbbr(s.topSeedTeam.abbrev)
  if (s.bottomSeedWins === 4) return normalizePoolAbbr(s.bottomSeedTeam.abbrev)
  return null
}

/**
 * Fills one pool-bracket’s official winners from the NHL’s published bracket.
 * A pool game is filled when there is a completed NHL series whose
 * *pair of teams* matches the pool (unordered) in the corresponding NHL
 * `playoffRound` (1=R1, 2=second round, …, 4=SCF) — same as pool round index + 1
 * for knockout alignment.
 */
export function buildOfficialResultsFromNhlBracket(
  data: NhlPlayoffBracketResponse,
  games: readonly BracketGame[] = GAMES,
): Picks {
  const index = buildSeriesByRoundAndPair(data)
  const out: Picks = {}
  for (const g of games) out[g.id] = null

  for (const g of games) {
    if (g.kind === 'r1') {
      const nhlR = 1
      const key = `${nhlR}|${teamPairKey(g.top.abbr, g.bottom.abbr)}`
      const s = index.get(key)
      const w = s ? winnerAbbrFromSeries(s) : null
      out[g.id] = w
    } else {
      const a = (out[g.feeds[0]] as string | null) ?? null
      const b = (out[g.feeds[1]] as string | null) ?? null
      if (a == null || b == null) {
        out[g.id] = null
        continue
      }
      const nhlR = g.round + 1
      const key = `${nhlR}|${teamPairKey(a, b)}`
      const s = index.get(key)
      out[g.id] = s ? winnerAbbrFromSeries(s) : null
    }
  }

  return out
}
