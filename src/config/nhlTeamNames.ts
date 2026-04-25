import type { Team } from './bracketTypes'

/**
 * Long names for NHL-style abbreviations (pool display; extend as needed).
 */
const NAMES: Readonly<Record<string, string>> = {
  ANA: 'Ducks',
  ARI: 'Coyotes',
  BOS: 'Bruins',
  BUF: 'Sabres',
  CGY: 'Flames',
  CAR: 'Hurricanes',
  CHI: 'Blackhawks',
  COL: 'Avalanche',
  CBJ: 'Blue Jackets',
  DAL: 'Stars',
  DET: 'Red Wings',
  EDM: 'Oilers',
  FLA: 'Panthers',
  LAK: 'Kings',
  MIN: 'Wild',
  MTL: 'Canadiens',
  NSH: 'Predators',
  NJD: 'Devils',
  NYI: 'Islanders',
  NYR: 'Rangers',
  OTT: 'Senators',
  PHI: 'Flyers',
  PIT: 'Penguins',
  SEA: 'Kraken',
  SJS: 'Sharks',
  STL: 'Blues',
  TBL: 'Lightning',
  TOR: 'Maple Leafs',
  UTA: 'Mammoth',
  UTH: 'Mammoth',
  UHC: 'Mammoth',
  VAN: 'Canucks',
  VGK: 'Golden Knights',
  WPG: 'Jets',
  WSH: 'Capitals',
}

export function nhlNameForAbbr(abbr: string): string {
  return NAMES[abbr] ?? abbr
}

export function t(abbr: string): Team {
  return { abbr, name: nhlNameForAbbr(abbr) }
}
