import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GAMES,
  allGameIds,
  getGameById,
} from './config/bracket-2026'
import type { Picks } from './config/bracketTypes'
import { BracketGameCard } from './components/BracketGameCard'
import {
  coerceOfficialResultsByFeeds,
  dependentGameIds,
} from './lib/bracketResolve'
import { POOL_NHL_PATH_YEAR } from './config/poolNhl'
import {
  loadNhlLastSyncAt,
  loadResults,
  loadScoreOverrides,
  saveNhlLastSyncAt,
  saveResults,
  saveScoreOverrides,
  type ScoreOverride,
  type ScoreOverrides,
} from './lib/persistence'
import { fetchNhlPlayoffBracket } from './lib/fetchNhlPlayoffBracket'
import { buildOfficialResultsFromNhlBracket } from './lib/syncNhlToPoolResults'
import { buildLeaderboard } from './lib/rankings'
import type { ParticipantsFile } from './config/participantsFromExcel.schema'
import poolFile from './config/participantsFromExcel.json' with { type: 'json' }
import officialResultsBaseline from './config/officialResultsBaseline.json' with { type: 'json' }
import './App.css'

const poolData = poolFile as ParticipantsFile
const { players: poolPlayers } = poolData

const FINAL_ID = 'g15' as const

type RoundIndex = 0 | 1 | 2 | 3
type ScoreField = 'total' | RoundIndex

function formatNhlLastSyncAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function emptyPicksForIds(ids: readonly string[]): Picks {
  const p: Picks = {}
  for (const id of ids) p[id] = null
  return p
}

/**
 * Shipped playoff snapshot: localStorage first, then keys in
 * `officialResultsBaseline.json` override (so curated nulls like g2 stay
 * in-progress even if an old save had MIN winning DAL/MIN). Remove a key
 * from that file when you want saves / NHL sync to own that slot again.
 */
function mergeOfficialResultsBaseline(saved: Picks): Picks {
  const empty = emptyPicksForIds([...allGameIds])
  const baseline = officialResultsBaseline as Picks
  const merged = { ...empty, ...saved, ...baseline }
  return coerceOfficialResultsByFeeds(merged, GAMES)
}

function applyScoreOverrides(
  rows: ReturnType<typeof buildLeaderboard>,
  overrides: ScoreOverrides,
): ReturnType<typeof buildLeaderboard> {
  const scored = rows.map((row) => {
    const override = overrides[row.id]
    const byRound = row.byRound.map((score, index) => {
      const round = index as RoundIndex
      return override?.byRound?.[round] ?? score
    }) as [number, number, number, number]
    const hasRoundOverride = [0, 1, 2, 3].some(
      (round) => override?.byRound?.[round as RoundIndex] != null,
    )
    const total =
      override?.total ??
      (hasRoundOverride
        ? byRound.reduce((sum, score) => sum + score, 0)
        : row.total)
    return { ...row, total, byRound }
  })

  return scored
    .map((row) => ({
      ...row,
      rank: 1 + scored.filter((other) => other.total > row.total).length,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.name.localeCompare(b.name)
    })
}

function parseScoreInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return Math.max(0, Math.trunc(value))
}

export default function App() {
  const [results, setResults] = useState<Picks>(() =>
    mergeOfficialResultsBaseline(loadResults()),
  )
  const [nhlError, setNhlError] = useState<string | null>(null)
  const [nhlLastSyncAt, setNhlLastSyncAt] = useState<string | null>(
    loadNhlLastSyncAt,
  )
  const [nhlBusy, setNhlBusy] = useState(false)
  const [scoreOverrides, setScoreOverrides] =
    useState<ScoreOverrides>(loadScoreOverrides)

  const calculatedRankings = useMemo(
    () => buildLeaderboard(poolPlayers, results, GAMES),
    [results],
  )

  const rankings = useMemo(
    () => applyScoreOverrides(calculatedRankings, scoreOverrides),
    [calculatedRankings, scoreOverrides],
  )

  const hasOfficialResults = useMemo(
    () => allGameIds.some((id) => (results[id] ?? null) != null),
    [results],
  )

  useEffect(() => {
    saveResults(results)
  }, [results])

  useEffect(() => {
    saveScoreOverrides(scoreOverrides)
  }, [scoreOverrides])

  const onResults = useCallback((gameId: string, abbr: string) => {
    setResults((prev) => {
      const next: Picks = { ...prev, [gameId]: abbr }
      for (const d of dependentGameIds(GAMES, [gameId])) {
        next[d] = null
      }
      return next
    })
  }, [])

  const onScoreOverride = useCallback(
    (playerId: string, field: ScoreField, value: number | null) => {
      setScoreOverrides((prev) => {
        const next = { ...prev }
        const current: ScoreOverride = next[playerId]
          ? {
              ...next[playerId],
              byRound: next[playerId].byRound
                ? { ...next[playerId].byRound }
                : undefined,
            }
          : {}

        if (field === 'total') {
          if (value == null) {
            delete current.total
          } else {
            current.total = value
          }
        } else {
          const byRound = { ...(current.byRound ?? {}) }
          if (value == null) {
            delete byRound[field]
          } else {
            byRound[field] = value
          }
          current.byRound =
            Object.keys(byRound).length > 0 ? byRound : undefined
        }

        if (current.total == null && current.byRound == null) {
          delete next[playerId]
        } else {
          next[playerId] = current
        }
        return next
      })
    },
    [],
  )

  const goOfficial = useCallback(() => {
    window.requestAnimationFrame(() => {
      document
        .getElementById('region-official-results')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const goStandings = useCallback(() => {
    document
      .getElementById('section-pool-standings')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="app">
      <header className="app__header">
        <ol className="app__howTo">
          <li>
            <button
              type="button"
              className="app__inlistLink"
              onClick={goOfficial}
            >
              Official results
            </button>
            {` show what actually happened. Update them manually or `}
            <button
              type="button"
              className="app__inlistLink"
              onClick={goOfficial}
            >
              sync from the NHL
            </button>
            {` after each series is decided.`}
          </li>
          <li>
            <button
              type="button"
              className="app__inlistLink"
              onClick={goStandings}
            >
              Pool standings
            </button>
            {` show the results for every already-picked bracket; admins can adjust the numbers directly in the grid.`}
          </li>
        </ol>
        <div className="app__titleRow">
          <div>
            <p className="app__eyebrow">Playoff pool</p>
            <h1>Stanley Cup pool results</h1>
          </div>
          {!hasOfficialResults ? (
            <div className="app__headerScoreCol">
              <div
                className="app__noOfficialBanner"
                role="status"
                aria-live="polite"
              >
                <p className="app__noOfficialBanner__text">
                  <strong>Standings need official results first.</strong> The pool
                  table stays at 0 until winners are set in Official results
                  (or synced from the NHL).
                </p>
                <div className="app__noOfficialBanner__actions">
                  <button
                    type="button"
                    className="app__textBtn app__textBtn--primary"
                    onClick={goOfficial}
                  >
                    Go to Official results
                  </button>
                  <button
                    type="button"
                    className="app__textBtn"
                    onClick={goStandings}
                  >
                    View pool standings
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <p className="app__lede">
          Scoring by round: 1-2-4-8. This page shows the official bracket and
          compiled results for every already-picked bracket in the import.
          Points appear once each series is decided. The{' '}
          <button
            type="button"
            className="app__inlistLink"
            onClick={goStandings}
          >
            pool standings
          </button>
          {` rank everyone in the import, with admin edits in the grid taking precedence.`}
        </p>
        <details className="app__meta">
          <summary>Data sources &amp; dev commands</summary>
          <p className="app__sub">
            Regenerate the bracket and standings from the workbook:{' '}
            <code className="app__code">Hockey Tracking.xlsx</code> →{' '}
            <code className="app__code">npm run pool:from-excel</code> (or{' '}
            <code className="app__code">bracket:from-excel</code> /{' '}
            <code className="app__code">participants:from-excel</code> only). Official
            NHL sync (when a matchup matches a real series) uses the path year in{' '}
            <code className="app__code">src/config/poolNhl.ts</code>.
          </p>
        </details>
        <div id="region-official-results" className="app__toolbar">
          <div className="app__mode">
            <span className="app__modeLabel">Official bracket</span>
          </div>
          <div className="app__nhl" aria-live="polite">
            <button
              type="button"
              className="btn-primary"
              id="sync-nhl-button"
              disabled={nhlBusy}
              onClick={async () => {
                if (
                  !confirm(
                    'Replace official results using completed series from the NHL (api-web.nhle.com)?',
                  )
                ) {
                  return
                }
                setNhlBusy(true)
                setNhlError(null)
                try {
                  const data = await fetchNhlPlayoffBracket(POOL_NHL_PATH_YEAR)
                  const next = buildOfficialResultsFromNhlBracket(data, GAMES)
                  setResults(next)
                  const at = new Date().toISOString()
                  saveNhlLastSyncAt(at)
                  setNhlLastSyncAt(at)
                } catch (e) {
                  setNhlError(
                    e instanceof Error
                      ? e.message
                      : 'Could not load the NHL bracket.',
                  )
                } finally {
                  setNhlBusy(false)
                }
              }}
            >
              {nhlBusy
                ? 'Loading…'
                : `Sync from NHL (year ${POOL_NHL_PATH_YEAR})`}
            </button>
          </div>
        </div>
        <p className="app__modeHint">
          Official results drive the pool standings below. In-progress series
          stay empty until someone clinches, so points lag the live schedule.
        </p>
        {nhlLastSyncAt ? (
          <p className="app__nhlTrust" role="status">
            NHL data loaded {formatNhlLastSyncAt(nhlLastSyncAt)}.
          </p>
        ) : null}
        {nhlError ? (
          <p className="app__nhlMsg app__nhlMsg--err" role="alert">
            {nhlError}
          </p>
        ) : null}
      </header>

      <main className="bracket" id="bracket-main">
        <h2 className="bracket__confHeading bracket__confHeading--west">
          Western Conference
        </h2>
        <h2 className="bracket__confHeading bracket__confHeading--championship">
          Championship
        </h2>
        <h2 className="bracket__confHeading bracket__confHeading--east">
          Eastern Conference
        </h2>

        <div className="bracket__col bracket__col--left">
          <div className="bracket__rounds">
            <div className="bracket__roundGroup">
              <h3 className="bracket__roundTitle">First round</h3>
              <div className="bracket__r1Grid">
                {(['g1', 'g2', 'g3', 'g4'] as const).map((id) => {
                  const g = getGameById(id)
                  if (!g) return null
                  return (
                    <BracketGameCard
                      key={id}
                      game={g}
                      state={results}
                      mode="results"
                      layout="bracket"
                      interactive
                      onPick={onResults}
                    />
                  )
                })}
              </div>
            </div>
            <div className="bracket__roundGroup">
              <h3 className="bracket__roundTitle">Second round</h3>
              <div className="bracket__r2Row">
                {(['g9', 'g10'] as const).map((id) => {
                  const g = getGameById(id)
                  if (!g) return null
                  return (
                    <BracketGameCard
                      key={id}
                      game={g}
                      state={results}
                      mode="results"
                      layout="bracket"
                      interactive
                      onPick={onResults}
                    />
                  )
                })}
              </div>
            </div>
            <div className="bracket__roundGroup">
              <h3 className="bracket__roundTitle">Conference finals</h3>
              {(() => {
                const g = getGameById('g13')
                if (!g) return null
                return (
                  <BracketGameCard
                    key="g13"
                    game={g}
                    state={results}
                    mode="results"
                    layout="bracket"
                    interactive
                    onPick={onResults}
                  />
                )
              })()}
            </div>
          </div>
        </div>

        <div className="bracket__col bracket__col--final">
          <h3 className="bracket__roundTitle bracket__roundTitle--center">
            Stanley Cup Final
          </h3>
          {(() => {
            const g = getGameById(FINAL_ID)
            if (!g) return null
            return (
              <BracketGameCard
                key={FINAL_ID}
                game={g}
                state={results}
                mode="results"
                layout="bracket"
                interactive
                onPick={onResults}
              />
            )
          })()}
        </div>

        <div className="bracket__col bracket__col--right">
          <div className="bracket__rounds">
            <div className="bracket__roundGroup">
              <h3 className="bracket__roundTitle">First round</h3>
              <div className="bracket__r1Grid">
                {(['g5', 'g6', 'g7', 'g8'] as const).map((id) => {
                  const g = getGameById(id)
                  if (!g) return null
                  return (
                    <BracketGameCard
                      key={id}
                      game={g}
                      state={results}
                      mode="results"
                      layout="bracket"
                      interactive
                      onPick={onResults}
                    />
                  )
                })}
              </div>
            </div>
            <div className="bracket__roundGroup">
              <h3 className="bracket__roundTitle">Second round</h3>
              <div className="bracket__r2Row">
                {(['g11', 'g12'] as const).map((id) => {
                  const g = getGameById(id)
                  if (!g) return null
                  return (
                    <BracketGameCard
                      key={id}
                      game={g}
                      state={results}
                      mode="results"
                      layout="bracket"
                      interactive
                      onPick={onResults}
                    />
                  )
                })}
              </div>
            </div>
            <div className="bracket__roundGroup">
              <h3 className="bracket__roundTitle">Conference finals</h3>
              {(() => {
                const g = getGameById('g14')
                if (!g) return null
                return (
                  <BracketGameCard
                    key="g14"
                    game={g}
                    state={results}
                    mode="results"
                    layout="bracket"
                    interactive
                    onPick={onResults}
                  />
                )
              })()}
            </div>
          </div>
        </div>
      </main>

      <section
        className="standings"
        id="section-pool-standings"
        aria-label="Pool standings"
      >
        <h2 className="standings__title standings__title--emph">Pool standings</h2>
        <p className="standings__sub">
          {hasOfficialResults ? (
            <>
              {poolPlayers.length} entries (Excel import), ranked on official
              results from above, with direct edits in this grid taking
              precedence. Round columns only include points from matchups with a
              decided winner (in-progress series stay at 0 for that slot).
            </>
          ) : (
            <>
              {poolPlayers.length} pool entries. Totals here stay 0 until you
              set{' '}
              <button
                type="button"
                className="app__inlistLink"
                onClick={goOfficial}
              >
                Official results
              </button>{' '}
              or use{' '}
              <button
                type="button"
                className="app__inlistLink"
                onClick={goOfficial}
              >
                Sync from NHL
              </button>
              {'.'}
            </>
          )}
        </p>
        <p className="standings__hintMobile">
          Compact view: rank, name, and editable total. Rotate or widen the
          screen to see R1-Final.
        </p>
        <div className="standings__tableWrap">
          <table className="standings__table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Name</th>
                <th scope="col">Total</th>
                <th scope="col" className="standings__colR">
                  R1
                </th>
                <th scope="col" className="standings__colR">
                  R2
                </th>
                <th scope="col" className="standings__colR">
                  R3
                </th>
                <th scope="col" className="standings__colR">
                  Final
                </th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row) => (
                <tr key={row.id}>
                  <td className="standings__num">{row.rank}</td>
                  <td className="standings__name">{row.name}</td>
                  <EditableScoreCell
                    value={row.total}
                    className="standings__num standings__num--total"
                    ariaLabel={`${row.name} total score`}
                    onChange={(value) =>
                      onScoreOverride(row.id, 'total', value)
                    }
                  />
                  <EditableScoreCell
                    value={row.byRound[0]}
                    className="standings__num standings__colR"
                    ariaLabel={`${row.name} round 1 score`}
                    onChange={(value) => onScoreOverride(row.id, 0, value)}
                  />
                  <EditableScoreCell
                    value={row.byRound[1]}
                    className="standings__num standings__colR"
                    ariaLabel={`${row.name} round 2 score`}
                    onChange={(value) => onScoreOverride(row.id, 1, value)}
                  />
                  <EditableScoreCell
                    value={row.byRound[2]}
                    className="standings__num standings__colR"
                    ariaLabel={`${row.name} round 3 score`}
                    onChange={(value) => onScoreOverride(row.id, 2, value)}
                  />
                  <EditableScoreCell
                    value={row.byRound[3]}
                    className="standings__num standings__colR"
                    ariaLabel={`${row.name} final score`}
                    onChange={(value) => onScoreOverride(row.id, 3, value)}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function EditableScoreCell({
  value,
  className,
  ariaLabel,
  onChange,
}: {
  value: number
  className: string
  ariaLabel: string
  onChange: (value: number | null) => void
}) {
  return (
    <td className={className}>
      <input
        className="standings__scoreInput"
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(parseScoreInput(event.currentTarget.value))}
      />
    </td>
  )
}
