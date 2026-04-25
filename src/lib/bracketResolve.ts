import { teamByAbbr } from '../config/bracket-2026'
import type { BracketGame, Picks, Team } from '../config/bracketTypes'

export function getSlotTeams(
  game: BracketGame,
  state: Picks,
): { top: Team | null; bottom: Team | null } {
  if (game.kind === 'r1') {
    return { top: game.top, bottom: game.bottom }
  }
  const [a, b] = game.feeds
  return {
    top: slotFromFeed(a, state),
    bottom: slotFromFeed(b, state),
  }
}

function slotFromFeed(feedGameId: string, state: Picks): Team | null {
  const w = state[feedGameId] ?? null
  if (w == null || w === '') return null
  return teamByAbbr.get(w) ?? null
}

/**
 * For clearing downstream picks when an upstream pick changes.
 * Returns all game ids that depend (transitively) on any of the given games.
 */
export function dependentGameIds(
  config: readonly BracketGame[],
  changedGameIds: readonly string[],
): Set<string> {
  const deps = new Map<string, Set<string>>()
  for (const g of config) {
    if (g.kind === 'ko') {
      for (const f of g.feeds) {
        if (!deps.has(f)) deps.set(f, new Set())
        deps.get(f)!.add(g.id)
      }
    }
  }
  const out = new Set<string>()
  const stack = [...changedGameIds]
  while (stack.length) {
    const id = stack.pop()!
    const next = deps.get(id)
    if (!next) continue
    for (const d of next) {
      if (!out.has(d)) {
        out.add(d)
        stack.push(d)
      }
    }
  }
  return out
}

