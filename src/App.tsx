import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GAMES,
  MAX_SCORE,
  allGameIds,
  getGameById,
} from './config/bracket-2026'
import type { Picks } from './config/bracketTypes'
import { BracketGameCard } from './components/BracketGameCard'
import { dependentGameIds } from './lib/bracketResolve'
import { POOL_NHL_PATH_YEAR } from './config/poolNhl'
import { loadPicks, loadResults, savePicks, saveResults } from './lib/persistence'
import { fetchNhlPlayoffBracket } from './lib/fetchNhlPlayoffBracket'
import { buildOfficialResultsFromNhlBracket } from './lib/syncNhlToPoolResults'
import { buildLeaderboard } from './lib/rankings'
import { scoreBracket } from './lib/score'
import type { ParticipantsFile } from './config/participantsFromExcel.schema'
import poolFile from './config/participantsFromExcel.json' with { type: 'json' }
import './App.css'

const { players: poolPlayers } = poolFile as ParticipantsFile

const LEFT_ORDER = [
  'g1',
  'g2',
  'g3',
  'g4',
  'g9',
  'g10',
  'g13',
] as const
const RIGHT_ORDER = [
  'g5',
  'g6',
  'g7',
  'g8',
  'g11',
  'g12',
  'g14',
] as const
const FINAL_ID = 'g15' as const

type EditorMode = 'picks' | 'results'

function emptyPicksForIds(ids: readonly string[]): Picks {
  const p: Picks = {}
  for (const id of ids) p[id] = null
  return p
}

export default function App() {
  const [picks, setPicks] = useState<Picks>(loadPicks)
  const [results, setResults] = useState<Picks>(loadResults)
  const [mode, setMode] = useState<EditorMode>('picks')
  const [nhlMessage, setNhlMessage] = useState<string | null>(null)
  const [nhlBusy, setNhlBusy] = useState(false)

  const scored = useMemo(
    () => scoreBracket(picks, results, GAMES),
    [picks, results],
  )

  const rankings = useMemo(
    () => buildLeaderboard(poolPlayers, results, GAMES),
    [results],
  )

  const hasOfficialResults = useMemo(
    () => allGameIds.some((id) => (results[id] ?? null) != null),
    [results],
  )

  const applyChoice = useCallback(
    (setState: typeof setPicks) =>
      (gameId: string, abbr: string) => {
        setState((prev) => {
          const next: Picks = { ...prev, [gameId]: abbr }
          for (const d of dependentGameIds(GAMES, [gameId])) {
            next[d] = null
          }
          return next
        })
      },
    [],
  )

  useEffect(() => {
    savePicks(picks)
  }, [picks])

  useEffect(() => {
    saveResults(results)
  }, [results])

  const onPicks = applyChoice(setPicks)
  const onResults = applyChoice(setResults)

  const stateForMode = mode === 'picks' ? picks : results
  const onPick = mode === 'picks' ? onPicks : onResults

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__titleRow">
          <div>
            <p className="app__eyebrow">Playoff pool</p>
            <h1>Stanley Cup bracket</h1>
          </div>
          <div className="app__scoreCard">
            <div className="score-total" aria-label="Your score">
              <span className="score-total__label">Your score</span>
              <span className="score-total__value" aria-live="polite">
                {scored.total}
              </span>
              <span className="score-total__max">out of {MAX_SCORE} points</span>
            </div>
            <ul className="score-by-round" aria-label="Points by round">
              <li>
                R1 <strong>{scored.byRound[0]}</strong>
              </li>
              <li>
                R2 <strong>{scored.byRound[1]}</strong>
              </li>
              <li>
                R3 <strong>{scored.byRound[2]}</strong>
              </li>
              <li>
                F <strong>{scored.byRound[3]}</strong>
              </li>
            </ul>
          </div>
        </div>
        <p className="app__lede">
          Picks and official results use the same bracket. Scoring by round: 1 · 2 ·
          4 · 8. Standings update from your official results and the pool Excel import.
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
        <div className="app__toolbar">
          <div className="app__mode">
            <span className="app__modeLabel">Editing</span>
            <div
              className="segmented"
              role="tablist"
              aria-label="Picks or official results"
            >
              <button
                type="button"
                role="tab"
                className={mode === 'picks' ? 'segmented__btn is-active' : 'segmented__btn'}
                onClick={() => setMode('picks')}
                aria-selected={mode === 'picks'}
              >
                My picks
              </button>
              <button
                type="button"
                role="tab"
                className={
                  mode === 'results' ? 'segmented__btn is-active' : 'segmented__btn'
                }
                onClick={() => setMode('results')}
                aria-selected={mode === 'results'}
              >
                Official results
              </button>
            </div>
          </div>
          {mode === 'results' && (
            <div className="app__nhl" aria-live="polite">
              <button
                type="button"
                className="btn-primary"
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
                  setNhlMessage(null)
                  try {
                    const data = await fetchNhlPlayoffBracket(POOL_NHL_PATH_YEAR)
                    const next = buildOfficialResultsFromNhlBracket(data, GAMES)
                    setResults(next)
                    setNhlMessage('Official results updated from NHL bracket.')
                  } catch (e) {
                    setNhlMessage(
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
          )}
        </div>
        {nhlMessage ? <p className="app__nhlMsg">{nhlMessage}</p> : null}
      </header>

      <main className="bracket">
        <div className="bracket__col bracket__col--left">
          <h2 className="bracket__sideTitle">Left bracket</h2>
          {LEFT_ORDER.map((id) => {
            const g = getGameById(id)
            if (!g) return null
            return (
              <BracketGameCard
                key={id}
                game={g}
                state={stateForMode}
                mode={mode}
                onPick={onPick}
              />
            )
          })}
        </div>
        <div className="bracket__col bracket__col--final">
          {(() => {
            const g = getGameById(FINAL_ID)
            if (!g) return null
            return (
              <BracketGameCard
                key={FINAL_ID}
                game={g}
                state={stateForMode}
                mode={mode}
                onPick={onPick}
              />
            )
          })()}
        </div>
        <div className="bracket__col bracket__col--right">
          <h2 className="bracket__sideTitle">Right bracket</h2>
          {RIGHT_ORDER.map((id) => {
            const g = getGameById(id)
            if (!g) return null
            return (
              <BracketGameCard
                key={id}
                game={g}
                state={stateForMode}
                mode={mode}
                onPick={onPick}
              />
            )
          })}
        </div>
      </main>

      <section className="standings" aria-label="Pool standings">
        <h2 className="standings__title">Pool standings</h2>
        <p className="standings__sub">
          {poolPlayers.length} entries from the Excel import. Scores use your
          &quot;Official results&quot; above; everyone ties at 0 until those are
          set (or use Sync from NHL).
        </p>
        {!hasOfficialResults ? (
          <p className="standings__note" role="status">
            No official results yet — all entries show 0 points.
          </p>
        ) : null}
        <div className="standings__tableWrap">
          <table className="standings__table">
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Name</th>
                <th scope="col">Total</th>
                <th scope="col">R1</th>
                <th scope="col">R2</th>
                <th scope="col">R3</th>
                <th scope="col">Final</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((row) => (
                <tr key={row.id}>
                  <td className="standings__num">{row.rank}</td>
                  <td className="standings__name">{row.name}</td>
                  <td className="standings__num">{row.total}</td>
                  <td className="standings__num">{row.byRound[0]}</td>
                  <td className="standings__num">{row.byRound[1]}</td>
                  <td className="standings__num">{row.byRound[2]}</td>
                  <td className="standings__num">{row.byRound[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="app__foot">
        <div className="app__actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (
                !confirm('Clear your picks? This does not clear official results.')
              )
                return
              setPicks(emptyPicksForIds([...allGameIds]))
            }}
          >
            Clear all picks
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (!confirm('Clear all official results?')) return
              setResults(emptyPicksForIds([...allGameIds]))
            }}
          >
            Clear official results
          </button>
        </div>
      </footer>
    </div>
  )
}
