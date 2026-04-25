export type BracketSide = 'left' | 'right' | 'final'

export type RoundIndex = 0 | 1 | 2 | 3

export interface Team {
  abbr: string
  name: string
}

export interface FirstRoundGame {
  kind: 'r1'
  id: string
  side: 'left' | 'right'
  indexInRound: number
  round: 0
  top: Team
  bottom: Team
}

export interface KnockoutGame {
  kind: 'ko'
  id: string
  side: BracketSide
  indexInRound: number
  round: 1 | 2 | 3
  feeds: readonly [string, string]
}

export type BracketGame = FirstRoundGame | KnockoutGame

export type Picks = Record<string, string | null>
