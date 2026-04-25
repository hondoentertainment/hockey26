import type { Picks } from './bracketTypes'

export type ExcelPoolPlayer = {
  id: string
  name: string
  picks: Picks
}

export type ParticipantsFile = {
  players: ExcelPoolPlayer[]
  /** Whose picks power the site bracket / “My picks”. Defaults to first player. */
  defaultPicksPlayerId?: string
}
