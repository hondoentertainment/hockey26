import { POINTS_BY_ROUND } from '../config/bracket-2026'
import type { BracketGame, Picks, Team } from '../config/bracketTypes'
import { getSlotTeams } from '../lib/bracketResolve'

type EditorMode = 'picks' | 'results'

type Props = {
  game: BracketGame
  state: Picks
  mode: EditorMode
  /** When false, winners are display-only (no pick changes). */
  interactive?: boolean
  /**
   * `bracket` = round labels live in the parent; hide per-card title and game id
   * (closer to ESPN’s matchup rows).
   */
  layout?: 'default' | 'bracket'
  onPick: (gameId: string, abbr: string) => void
}

const ROUND_TITLES = [
  'First round',
  'Second round',
  'Third round',
  'Championship',
] as const

export function BracketGameCard({
  game,
  state,
  mode,
  interactive = true,
  layout = 'default',
  onPick,
}: Props) {
  const pts = POINTS_BY_ROUND[game.round]
  const { top, bottom } = getSlotTeams(game, state)
  const picked = (state[game.id] as string | null) ?? null
  const topDisabled = !top
  const bottomDisabled = !bottom
  const title = `${ROUND_TITLES[game.round]} · ${pts} pt${pts === 1 ? '' : 's'}`
  const groupLabel =
    mode === 'picks'
      ? interactive
        ? 'Pick a winner'
        : 'Picks (from pool import, read-only)'
      : 'Set the winner'
  const bracketMode = layout === 'bracket'

  return (
    <div
      className={bracketMode ? 'game-card game-card--bracket' : 'game-card'}
      data-game={game.id}
      data-side={game.side}
      data-readonly-picks={interactive ? undefined : 'true'}
    >
      {bracketMode ? null : (
        <div className="game-card__head">
          <span className="game-card__title">{title}</span>
          <span className="game-card__id">#{game.id.toUpperCase()}</span>
        </div>
      )}
      <div className="game-card__teams" role="group" aria-label={groupLabel}>
        <TeamButton
          team={top}
          disabled={topDisabled}
          selected={picked}
          interactive={interactive}
          onPick={() => top && onPick(game.id, top.abbr)}
        />
        <span className="game-card__vs" aria-hidden="true">
          vs
        </span>
        <TeamButton
          team={bottom}
          disabled={bottomDisabled}
          selected={picked}
          interactive={interactive}
          onPick={() => bottom && onPick(game.id, bottom.abbr)}
        />
      </div>
    </div>
  )
}

function TeamButton({
  team,
  disabled,
  selected,
  interactive,
  onPick,
}: {
  team: Team | null
  disabled: boolean
  selected: string | null
  interactive: boolean
  onPick: () => void
}) {
  const abbr = team?.abbr ?? '—'
  const name = team?.name
  const isOn = team != null && selected === team.abbr
  return (
    <button
      type="button"
      className={
        isOn
          ? 'team-btn team-btn--selected'
          : interactive
            ? 'team-btn'
            : 'team-btn team-btn--noninteractive'
      }
      disabled={disabled}
      onClick={interactive ? onPick : undefined}
      tabIndex={interactive ? undefined : -1}
      aria-disabled={interactive ? undefined : true}
      aria-pressed={isOn}
      title={name}
    >
      <span className="team-btn__abbr">{abbr}</span>
      {name ? <span className="team-btn__name">{name}</span> : null}
    </button>
  )
}
