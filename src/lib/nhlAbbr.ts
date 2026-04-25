/**
 * Map NHL/official abbreviations to the abbreviations used in the pool `bracket-20xx` config.
 */
const ALIASES: Readonly<Record<string, string>> = {
  UTH: 'UTA',
  UHC: 'UTA',
  UTA: 'UTA',
}

export function normalizePoolAbbr(abbr: string): string {
  const t = abbr.trim().toUpperCase()
  return ALIASES[t] ?? t
}

export function teamPairKey(a: string, b: string): string {
  return [normalizePoolAbbr(a), normalizePoolAbbr(b)].sort().join('|')
}
