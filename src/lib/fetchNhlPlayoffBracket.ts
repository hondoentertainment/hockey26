import { POOL_NHL_PATH_YEAR } from '../config/poolNhl'
import type { NhlPlayoffBracketResponse } from './nhlPlayoffApiTypes'

function bracketUrls(year: number | string): string[] {
  const y = String(year)
  if (import.meta.env.DEV) {
    return [`/nhl-api/v1/playoff-bracket/${y}`]
  }
  return [
    `/api/nhl-bracket?year=${encodeURIComponent(y)}`,
    `https://api-web.nhle.com/v1/playoff-bracket/${y}`,
  ]
}

export async function fetchNhlPlayoffBracket(
  year: number | string = POOL_NHL_PATH_YEAR,
): Promise<NhlPlayoffBracketResponse> {
  const lastError: { message: string }[] = []
  for (const u of bracketUrls(year)) {
    try {
      const r = await fetch(u, { headers: { Accept: 'application/json' } })
      if (!r.ok) {
        lastError[0] = { message: `${r.status} ${r.statusText}` }
        continue
      }
      const j = (await r.json()) as NhlPlayoffBracketResponse
      if (!j || !Array.isArray(j.series)) {
        lastError[0] = { message: 'Invalid JSON shape' }
        continue
      }
      return j
    } catch (e) {
      lastError[0] = {
        message: e instanceof Error ? e.message : 'fetch failed',
      }
    }
  }
  const msg = lastError[0]?.message ?? 'unknown'
  throw new Error(`NHL bracket unavailable: ${msg}`)
}
