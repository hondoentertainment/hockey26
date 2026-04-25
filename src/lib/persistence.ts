import type { Picks } from '../config/bracketTypes'

const KEY_PICKS = 'hockey26.picks'
const KEY_RESULTS = 'hockey26.results'
const KEY_NHL_LAST_SYNC = 'hockey26.nhlLastSyncAt'

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
