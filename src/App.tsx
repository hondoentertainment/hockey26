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
import { scoreBracket } from './lib/score'
import './App.css'

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
        <h1>Stanley Cup pool</h1>
        <p className="app__sub">
          Round scoring: 1 + 2 + 4 + 8 pts · max {MAX_SCORE} total. First round is
          loaded from <code className="app__code">bracketFromExcel.json</code> (regenerate
          from <code className="app__code">Hockey Tracking.xlsx</code> with{' '}
          <code className="app__code">npm run bracket:from-excel</code>). Official
          results can be synced from the NHL when a matchup matches a real series (
          <code className="app__code">src/config/poolNhl.ts</code>).
        </p>
        <div className="app__mode">
          <span className="app__modeLabel">You are editing</span>
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
            >
              Official results
            </button>
          </div>
        </div>
        <div className="app__score">
          <div className="score-total">
            <span className="score-total__label">Your score</span>
            <span className="score-total__value" aria-live="polite">
              {scored.total} / {MAX_SCORE}
            </span>
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
              Final <strong>{scored.byRound[3]}</strong>
            </li>
          </ul>
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
                ? 'Loading NHL data…'
                : `Sync from NHL (year ${POOL_NHL_PATH_YEAR})`}
            </button>
            {nhlMessage ? <p className="app__nhlMsg">{nhlMessage}</p> : null}
          </div>
        )}
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
