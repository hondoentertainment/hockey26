import type { Picks } from '../config/bracketTypes'
import type { ParticipantsFile } from '../config/participantsFromExcel.schema'

/** Picks and display name for the single bracket shown under “My picks”. */
export function getSitePicksSource(file: ParticipantsFile): {
  picks: Picks
  name: string
} {
  const list = file.players ?? []
  const byId = file.defaultPicksPlayerId
    ? list.find((p) => p.id === file.defaultPicksPlayerId)
    : undefined
  const chosen = byId ?? list[0]
  if (!chosen) return { picks: {}, name: 'Pool import' }
  return { picks: { ...chosen.picks }, name: chosen.name }
}
