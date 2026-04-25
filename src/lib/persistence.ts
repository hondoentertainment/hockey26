import type { Picks } from '../config/bracketTypes'

const KEY_PICKS = 'hockey26.picks'
const KEY_RESULTS = 'hockey26.results'

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
