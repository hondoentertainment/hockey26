/** Relevant parts of `GET https://api-web.nhle.com/v1/playoff-bracket/{YEAR}`. */
export type NhlBracketTeam = {
  id: number
  abbrev: string
  name: { default: string }
}

export type NhlPlayoffSeries = {
  playoffRound: number
  seriesTitle?: string
  topSeedWins: number
  bottomSeedWins: number
  winningTeamId?: number
  topSeedTeam: NhlBracketTeam
  bottomSeedTeam: NhlBracketTeam
}

export type NhlPlayoffBracketResponse = {
  series: NhlPlayoffSeries[]
}
