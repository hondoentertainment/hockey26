/**
 * Fetches the current NHL playoff bracket and updates two static baselines:
 *   src/config/officialResultsBaseline.json  — series winners (locked once set)
 *   src/config/seriesScoresBaseline.json     — per-R1-game win counts (for display)
 *
 * Usage: node scripts/update-stats.mjs [YEAR]
 * Exit 0 = success (files may or may not have changed)
 * Exit 1 = network / parse error (files left unchanged)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const year = process.argv[2] ?? '2026'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── Abbreviation helpers ───────────────────────────────────────────────────

const ALIASES = { UTH: 'UTA', UHC: 'UTA' }
const norm = (a) => { const t = a.trim().toUpperCase(); return ALIASES[t] ?? t }
const pairKey = (a, b) => [norm(a), norm(b)].sort().join('|')

// ── Fetch NHL bracket ──────────────────────────────────────────────────────

const url = `https://api-web.nhle.com/v1/playoff-bracket/${year}`
console.log(`Fetching ${url} …`)
let data
try {
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`NHL API ${res.status}: ${await res.text()}`)
    process.exit(1)
  }
  data = await res.json()
} catch (err) {
  console.error(`Fetch failed: ${err.message}`)
  process.exit(1)
}

// ── Index NHL series ───────────────────────────────────────────────────────

const nhl = new Map()
for (const s of data.series ?? []) {
  if (!s?.topSeedTeam?.abbrev || !s?.bottomSeedTeam?.abbrev) continue
  const key = `${s.playoffRound}|${pairKey(s.topSeedTeam.abbrev, s.bottomSeedTeam.abbrev)}`
  nhl.set(key, s)
}

function getWinner(s) {
  if (!s || (s.topSeedWins < 4 && s.bottomSeedWins < 4)) return null
  if (s.winningTeamId) {
    if (s.topSeedTeam.id === s.winningTeamId) return norm(s.topSeedTeam.abbrev)
    if (s.bottomSeedTeam.id === s.winningTeamId) return norm(s.bottomSeedTeam.abbrev)
  }
  if (s.topSeedWins >= 4) return norm(s.topSeedTeam.abbrev)
  if (s.bottomSeedWins >= 4) return norm(s.bottomSeedTeam.abbrev)
  return null
}

// ── Pool bracket structure ─────────────────────────────────────────────────

const bracket = JSON.parse(
  readFileSync(join(ROOT, 'src/config/bracketFromExcel.json'), 'utf8'),
)

const R1 = [
  ...bracket.left.map((p, i) => ({ id: `g${i + 1}`, top: p[0], bottom: p[1] })),
  ...bracket.right.map((p, i) => ({ id: `g${i + 5}`, top: p[0], bottom: p[1] })),
]

const KO = [
  { id: 'g9',  nhlRound: 2, feeds: ['g1', 'g2'] },
  { id: 'g10', nhlRound: 2, feeds: ['g3', 'g4'] },
  { id: 'g11', nhlRound: 2, feeds: ['g5', 'g6'] },
  { id: 'g12', nhlRound: 2, feeds: ['g7', 'g8'] },
  { id: 'g13', nhlRound: 3, feeds: ['g9', 'g10'] },
  { id: 'g14', nhlRound: 3, feeds: ['g11', 'g12'] },
  { id: 'g15', nhlRound: 4, feeds: ['g13', 'g14'] },
]

// ── Compute winners and R1 scores ──────────────────────────────────────────

const computedWinners = {}
const newR1Scores = {}

// R1: determine win counts and winner
for (const g of R1) {
  const s = nhl.get(`1|${pairKey(g.top, g.bottom)}`)
  if (!s) {
    computedWinners[g.id] = null
    newR1Scores[g.id] = null
    continue
  }

  const poolTopIsNhlTop = norm(g.top) === norm(s.topSeedTeam.abbrev)
  const poolTopWins    = poolTopIsNhlTop ? s.topSeedWins    : s.bottomSeedWins
  const poolBottomWins = poolTopIsNhlTop ? s.bottomSeedWins : s.topSeedWins

  newR1Scores[g.id] = { topWins: poolTopWins, bottomWins: poolBottomWins }
  computedWinners[g.id] =
    poolTopWins >= 4 ? norm(g.top) : poolBottomWins >= 4 ? norm(g.bottom) : null
}

// R2-Final: resolve teams from prior winners, then look up series
for (const g of KO) {
  const a = computedWinners[g.feeds[0]]
  const b = computedWinners[g.feeds[1]]
  if (!a || !b) { computedWinners[g.id] = null; continue }
  const s = nhl.get(`${g.nhlRound}|${pairKey(a, b)}`)
  computedWinners[g.id] = getWinner(s)
}

// ── Load current baselines ─────────────────────────────────────────────────

const resultsPath = join(ROOT, 'src/config/officialResultsBaseline.json')
const scoresPath  = join(ROOT, 'src/config/seriesScoresBaseline.json')

const currentResults = JSON.parse(readFileSync(resultsPath, 'utf8'))
const currentScores  = JSON.parse(readFileSync(scoresPath,  'utf8'))

// ── Merge into new baselines ───────────────────────────────────────────────

// officialResults: only add winners that aren't already set (never un-set)
const newResults = { ...currentResults }
for (const [id, winner] of Object.entries(computedWinners)) {
  if (winner != null && newResults[id] == null) {
    newResults[id] = winner
  }
}

// seriesScores: update R1 win counts; preserve $schemaNote
const schemaNote = currentScores['$schemaNote']
const newScores = {}
if (schemaNote) newScores['$schemaNote'] = schemaNote
for (const g of R1) {
  newScores[g.id] = newR1Scores[g.id] ?? currentScores[g.id] ?? null
}

// ── Detect changes ─────────────────────────────────────────────────────────

const resultsChanged = JSON.stringify(newResults) !== JSON.stringify(currentResults)
const scoresChanged  = JSON.stringify(newScores)  !== JSON.stringify(currentScores)

if (!resultsChanged && !scoresChanged) {
  console.log('No changes — stats are current.')
  process.exit(0)
}

// ── Write ──────────────────────────────────────────────────────────────────

if (resultsChanged) {
  writeFileSync(resultsPath, JSON.stringify(newResults, null, 2) + '\n', 'utf8')
  console.log('Updated officialResultsBaseline.json:')
  for (const [id, winner] of Object.entries(computedWinners)) {
    if (winner != null && currentResults[id] == null) {
      const g = R1.find((r) => r.id === id)
      const label = g ? `${g.top} vs ${g.bottom}` : id
      console.log(`  ${id} (${label}): → ${winner} wins series`)
    }
  }
}

if (scoresChanged) {
  writeFileSync(scoresPath, JSON.stringify(newScores, null, 2) + '\n', 'utf8')
  console.log('Updated seriesScoresBaseline.json:')
  for (const g of R1) {
    const prev = currentScores[g.id]
    const next = newScores[g.id]
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      const p = prev ? `${prev.topWins}-${prev.bottomWins}` : 'n/a'
      const n = next ? `${next.topWins}-${next.bottomWins}` : 'n/a'
      console.log(`  ${g.id} (${g.top} v ${g.bottom}): ${p} → ${n}`)
    }
  }
}
