import type { Picks } from '../config/bracketTypes'

const KEY_PICKS = 'hockey26.picks'
const KEY_RESULTS = 'hockey26.results'
const KEY_NHL_LAST_SYNC = 'hockey26.nhlLastSyncAt'
const KEY_SCORE_OVERRIDES = 'hockey26.scoreOverrides'

export type ScoreOverride = {
  total?: number
  byRound?: Partial<Record<0 | 1 | 2 | 3, number>>
}

export type ScoreOverrides = Record<string, ScoreOverride>

function readJson(key: string): Picks {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (p == null || typeof p !== 'object' || Array.isArray(p)) return {}
    return p as Picks
  } catch {
    return {}
  }
}

function writeJson(key: string, value: Picks): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

function loadScoreOverridesJson(): ScoreOverrides {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY_SCORE_OVERRIDES)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const out: ScoreOverrides = {}
    for (const [playerId, value] of Object.entries(parsed)) {
      if (value == null || typeof value !== 'object' || Array.isArray(value)) {
        continue
      }
      const source = value as {
        total?: unknown
        byRound?: unknown
      }
      const next: ScoreOverride = {}
      if (typeof source.total === 'number' && Number.isFinite(source.total)) {
        next.total = source.total
      }
      if (
        source.byRound != null &&
        typeof source.byRound === 'object' &&
        !Array.isArray(source.byRound)
      ) {
        const byRound: ScoreOverride['byRound'] = {}
        for (const round of [0, 1, 2, 3] as const) {
          const valueForRound = (source.byRound as Record<string, unknown>)[round]
          if (
            typeof valueForRound === 'number' &&
            Number.isFinite(valueForRound)
          ) {
            byRound[round] = valueForRound
          }
        }
        if (Object.keys(byRound).length > 0) next.byRound = byRound
      }
      if (next.total != null || next.byRound != null) out[playerId] = next
    }
    return out
  } catch {
    return {}
  }
}

function saveScoreOverridesJson(value: ScoreOverrides): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY_SCORE_OVERRIDES, JSON.stringify(value))
  } catch {
    // ignore quota / private mode
  }
}

export function loadPicks(): Picks {
  return readJson(KEY_PICKS)
}

export function savePicks(picks: Picks): void {
  writeJson(KEY_PICKS, picks)
}

export function loadResults(): Picks {
  return readJson(KEY_RESULTS)
}

export function saveResults(results: Picks): void {
  writeJson(KEY_RESULTS, results)
}

export function loadScoreOverrides(): ScoreOverrides {
  return loadScoreOverridesJson()
}

export function saveScoreOverrides(overrides: ScoreOverrides): void {
  saveScoreOverridesJson(overrides)
}

/** ISO timestamp string from the last successful NHL sync, or null. */
export function loadNhlLastSyncAt(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY_NHL_LAST_SYNC)
    if (!raw) return null
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : raw
  } catch {
    return null
  }
}

export function saveNhlLastSyncAt(iso: string | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (iso == null) {
      localStorage.removeItem(KEY_NHL_LAST_SYNC)
    } else {
      localStorage.setItem(KEY_NHL_LAST_SYNC, iso)
    }
  } catch {
    // ignore
  }
}
