import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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
const ADMIN_EMAIL = 'hondo4185@gmail.com'
const ADMIN_EMAIL_STORAGE_KEY = 'hockey26.adminAccountEmail'
const RAW_PICK_COLUMNS = [
  ['1A', 'g1'],
  ['1B', 'g2'],
  ['1C', 'g3'],
  ['1D', 'g4'],
  ['1E', 'g5'],
  ['1F', 'g6'],
  ['1G', 'g7'],
  ['1H', 'g8'],
  ['2A', 'g9'],
  ['2B', 'g10'],
  ['2C', 'g11'],
  ['2D', 'g12'],
  ['3A', 'g13'],
  ['3B', 'g14'],
  ['4', 'g15'],
] as const

type RoundIndex = 0 | 1 | 2 | 3
type ScoreField = 'total' | RoundIndex
type Page = 'public' | 'admin'

function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getPageFromHash(): Page {
  if (typeof window === 'undefined') return 'public'
  return window.location.hash.toLowerCase() === '#admin' ? 'admin' : 'public'
}

function loadAdminAccountEmail(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY)
  } catch {
    return null
  }
}

function saveAdminAccountEmail(email: string | null): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (email == null) {
      localStorage.removeItem(ADMIN_EMAIL_STORAGE_KEY)
    } else {
      localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, email)
    }
  } catch {
    // ignore quota / private mode
  }
}

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
  const [page, setPage] = useState<Page>(() => getPageFromHash())
  const [adminAccountEmail, setAdminAccountEmail] = useState<string | null>(
    loadAdminAccountEmail,
  )
  const [adminEmailInput, setAdminEmailInput] = useState(
    () => loadAdminAccountEmail() ?? '',
  )
  const [adminEmailError, setAdminEmailError] = useState<string | null>(null)
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

  const rankingsById = useMemo(
    () => new Map(rankings.map((row) => [row.id, row])),
    [rankings],
  )

  const hasOfficialResults = useMemo(
    () => allGameIds.some((id) => (results[id] ?? null) != null),
    [results],
  )

  const isAdminAccount =
    normalizeAccountEmail(adminAccountEmail ?? '') === ADMIN_EMAIL
  const isAdminPage = page === 'admin'
  const canUseDataActions = isAdminPage && isAdminAccount

  useEffect(() => {
    const onHashChange = () => setPage(getPageFromHash())
    window.addEventListener('hashchange', onHashChange)
    onHashChange()
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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

  const goPublic = useCallback(() => {
    window.location.hash = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goAdmin = useCallback(() => {
    window.location.hash = 'admin'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const onAdminSignIn = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmed = adminEmailInput.trim()
      if (normalizeAccountEmail(trimmed) !== ADMIN_EMAIL) {
        setAdminEmailError('That account is not allowed to access admin tools.')
        return
      }

      saveAdminAccountEmail(trimmed)
      setAdminAccountEmail(trimmed)
      setAdminEmailError(null)
    },
    [adminEmailInput],
  )

  const onAdminSignOut = useCallback(() => {
    saveAdminAccountEmail(null)
    setAdminAccountEmail(null)
    setAdminEmailInput('')
  }, [])

  if (isAdminPage && !isAdminAccount) {
    return (
      <AdminGate
        email={adminEmailInput}
        error={adminEmailError}
        onEmailChange={(value) => {
          setAdminEmailInput(value)
          setAdminEmailError(null)
        }}
        onSubmit={onAdminSignIn}
        onBack={goPublic}
      />
    )
  }

  return (
    <div className="app">
      <header className="app__header">
        <nav className="app__nav" aria-label="Page navigation">
          <button
            type="button"
            className={
              isAdminPage ? 'app__navLink' : 'app__navLink app__navLink--active'
            }
            onClick={goPublic}
          >
            Public results
          </button>
          <button
            type="button"
            className={
              isAdminPage ? 'app__navLink app__navLink--active' : 'app__navLink'
            }
            onClick={goAdmin}
          >
            Admin
          </button>
          {canUseDataActions ? (
            <span className="app__adminStatus">
              Signed in as {adminAccountEmail}
              <button
                type="button"
                className="app__adminSignOut"
                onClick={onAdminSignOut}
              >
                Sign out
              </button>
            </span>
          ) : null}
        </nav>
        <ol className="app__howTo">
          <li>
            <button
              type="button"
              className="app__inlistLink"
              onClick={goOfficial}
            >
              Official results
            </button>
            {canUseDataActions
              ? ` show what actually happened. Update them manually or sync from the NHL after each series is decided.`
              : ` show what actually happened. Data updates live on the admin page.`}
          </li>
          <li>
            <button
              type="button"
              className="app__inlistLink"
              onClick={goStandings}
            >
              Pool standings
            </button>
            {canUseDataActions
              ? ` show the results for every already-picked bracket; admins can adjust the numbers directly in the grid.`
              : ` show the results for every already-picked bracket in read-only mode.`}
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
          {canUseDataActions
            ? ` rank everyone in the import, with admin edits in the grid taking precedence.`
            : ` rank everyone in the import.`}
        </p>
        {canUseDataActions ? (
          <details className="app__meta">
            <summary>Data sources &amp; dev commands</summary>
            <p className="app__sub">
              Regenerate the bracket and standings from the workbook:{' '}
              <code className="app__code">Hockey Tracking.xlsx</code> →{' '}
              <code className="app__code">npm run pool:from-excel</code> (or{' '}
              <code className="app__code">bracket:from-excel</code> /{' '}
              <code className="app__code">participants:from-excel</code> only).
              Official NHL sync (when a matchup matches a real series) uses the
              path year in <code className="app__code">src/config/poolNhl.ts</code>.
            </p>
          </details>
        ) : null}
        <div id="region-official-results" className="app__toolbar">
          <div className="app__mode">
            <span className="app__modeLabel">
              {canUseDataActions ? 'Admin official bracket' : 'Official bracket'}
            </span>
          </div>
          {canUseDataActions ? (
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
                  ? 'Loading...'
                  : `Sync from NHL (year ${POOL_NHL_PATH_YEAR})`}
              </button>
            </div>
          ) : null}
        </div>
        <p className="app__modeHint">
          {canUseDataActions
            ? 'Official results drive the pool standings below. In-progress series stay empty until someone clinches, so points lag the live schedule.'
            : 'Official results drive the pool standings below. Open the admin page to change winners, sync from NHL, or adjust scores.'}
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
                      interactive={canUseDataActions}
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
                      interactive={canUseDataActions}
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
                    interactive={canUseDataActions}
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
                interactive={canUseDataActions}
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
                      interactive={canUseDataActions}
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
                      interactive={canUseDataActions}
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
                    interactive={canUseDataActions}
                    onPick={onResults}
                  />
                )
              })()}
            </div>
          </div>
        </div>
      </main>

      <section
        className={canUseDataActions ? 'standings standings--admin' : 'standings'}
        id="section-pool-standings"
        aria-label={canUseDataActions ? 'Admin data grid' : 'Pool standings'}
      >
        <h2 className="standings__title standings__title--emph">
          {canUseDataActions ? 'Admin data grid' : 'Pool standings'}
        </h2>
        <p className="standings__sub">
          {hasOfficialResults ? (
            <>
              {poolPlayers.length} entries (Excel import), ranked on official
              results from above. Round columns only include points from
              matchups with a decided winner (in-progress series stay at 0 for
              that slot).
              {canUseDataActions
                ? ' Admin score edits in this grid take precedence.'
                : ''}
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
              </button>
              {canUseDataActions
                ? ' or use Sync from NHL.'
                : ' from the admin page.'}
            </>
          )}
        </p>
        <p className="standings__hintMobile">
          {canUseDataActions
            ? 'Full admin grid: all populated score columns are shown and can scroll horizontally on small screens.'
            : 'Compact view: rank, name, and total. Rotate or widen the screen to see R1-Final.'}
        </p>
        <div
          className={
            canUseDataActions
              ? 'standings__tableWrap standings__tableWrap--full'
              : 'standings__tableWrap'
          }
        >
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
                  {canUseDataActions ? (
                    <EditableScoreCell
                      value={row.total}
                      className="standings__num standings__num--total"
                      ariaLabel={`${row.name} total score`}
                      onChange={(value) =>
                        onScoreOverride(row.id, 'total', value)
                      }
                    />
                  ) : (
                    <StaticScoreCell
                      value={row.total}
                      className="standings__num standings__num--total"
                    />
                  )}
                  {canUseDataActions ? (
                    <EditableScoreCell
                      value={row.byRound[0]}
                      className="standings__num standings__colR"
                      ariaLabel={`${row.name} round 1 score`}
                      onChange={(value) => onScoreOverride(row.id, 0, value)}
                    />
                  ) : (
                    <StaticScoreCell
                      value={row.byRound[0]}
                      className="standings__num standings__colR"
                    />
                  )}
                  {canUseDataActions ? (
                    <EditableScoreCell
                      value={row.byRound[1]}
                      className="standings__num standings__colR"
                      ariaLabel={`${row.name} round 2 score`}
                      onChange={(value) => onScoreOverride(row.id, 1, value)}
                    />
                  ) : (
                    <StaticScoreCell
                      value={row.byRound[1]}
                      className="standings__num standings__colR"
                    />
                  )}
                  {canUseDataActions ? (
                    <EditableScoreCell
                      value={row.byRound[2]}
                      className="standings__num standings__colR"
                      ariaLabel={`${row.name} round 3 score`}
                      onChange={(value) => onScoreOverride(row.id, 2, value)}
                    />
                  ) : (
                    <StaticScoreCell
                      value={row.byRound[2]}
                      className="standings__num standings__colR"
                    />
                  )}
                  {canUseDataActions ? (
                    <EditableScoreCell
                      value={row.byRound[3]}
                      className="standings__num standings__colR"
                      ariaLabel={`${row.name} final score`}
                      onChange={(value) => onScoreOverride(row.id, 3, value)}
                    />
                  ) : (
                    <StaticScoreCell
                      value={row.byRound[3]}
                      className="standings__num standings__colR"
                    />
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canUseDataActions ? (
        <section
          className="raw-sheet"
          aria-labelledby="raw-hockey-tracking-title"
        >
          <h2
            className="standings__title standings__title--emph"
            id="raw-hockey-tracking-title"
          >
            Raw Hockey Tracking sheet
          </h2>
          <p className="standings__sub">
            Raw import from <code className="app__code">{poolData.source}</code>,
            including the original sheet numbers, calculated score numbers, and
            unformatted pick columns.
          </p>
          <div className="raw-sheet__tableWrap">
            <table className="raw-sheet__table">
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Name</th>
                  <th scope="col">Rank</th>
                  <th scope="col">Total</th>
                  <th scope="col">R1</th>
                  <th scope="col">R2</th>
                  <th scope="col">R3</th>
                  <th scope="col">Final</th>
                  {RAW_PICK_COLUMNS.map(([header]) => (
                    <th scope="col" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {poolPlayers.map((player) => {
                  const ranking = rankingsById.get(player.id)
                  return (
                    <tr key={player.id}>
                      <td className="raw-sheet__num">{player.id}</td>
                      <td className="raw-sheet__name">{player.name}</td>
                      <td className="raw-sheet__num">{ranking?.rank ?? ''}</td>
                      <td className="raw-sheet__num raw-sheet__num--total">
                        {ranking?.total ?? ''}
                      </td>
                      <td className="raw-sheet__num">{ranking?.byRound[0] ?? ''}</td>
                      <td className="raw-sheet__num">{ranking?.byRound[1] ?? ''}</td>
                      <td className="raw-sheet__num">{ranking?.byRound[2] ?? ''}</td>
                      <td className="raw-sheet__num">{ranking?.byRound[3] ?? ''}</td>
                      {RAW_PICK_COLUMNS.map(([header, gameId]) => (
                        <td className="raw-sheet__pick" key={header}>
                          {player.picks[gameId] ?? ''}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function AdminGate({
  email,
  error,
  onEmailChange,
  onSubmit,
  onBack,
}: {
  email: string
  error: string | null
  onEmailChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onBack: () => void
}) {
  return (
    <div className="app app--gate">
      <section className="admin-gate" aria-labelledby="admin-gate-title">
        <p className="app__eyebrow">Admin access</p>
        <h1 id="admin-gate-title">Admin page</h1>
        <p className="admin-gate__copy">
          Data actions are only available to the {ADMIN_EMAIL} account.
        </p>
        <form className="admin-gate__form" onSubmit={onSubmit}>
          <label className="admin-gate__label" htmlFor="admin-email">
            Account email
          </label>
          <input
            id="admin-email"
            className="admin-gate__input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => onEmailChange(event.currentTarget.value)}
            placeholder={ADMIN_EMAIL}
          />
          {error ? (
            <p className="admin-gate__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="admin-gate__actions">
            <button type="submit" className="btn-primary">
              Continue
            </button>
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back to public results
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function StaticScoreCell({
  value,
  className,
}: {
  value: number
  className: string
}) {
  return <td className={className}>{value}</td>
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
