/**
 * Reads `Hockey Tracking.xlsx` and writes `src/config/participantsFromExcel.json`
 * (pool picks per row for the leaderboard). Regenerate: npm run participants:from-excel
 */
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __d = dirname(fileURLToPath(import.meta.url))
const root = join(__d, '..')
const xlsxPath = process.argv[2] || join(root, 'Hockey Tracking.xlsx')
const outPath = join(root, 'src', 'config', 'participantsFromExcel.json')

/** Map Excel pick column header (string form) to pool `g*` id. */
const HEADER_TO_GAME = {
  '1A': 'g1',
  '1B': 'g2',
  '1C': 'g3',
  '1D': 'g4',
  '1E': 'g5',
  '1F': 'g6',
  '1G': 'g7',
  '1H': 'g8',
  '2A': 'g9',
  '2B': 'g10',
  '2C': 'g11',
  '2D': 'g12',
  '3A': 'g13',
  '3B': 'g14',
  '4': 'g15',
}

function headerToGameId(cell) {
  if (cell == null) return null
  if (typeof cell === 'number' && cell === 4) {
    return 'g15'
  }
  const s = String(cell).trim()
  if (s === '4') return 'g15'
  if (s === 'Name' || s === 'Number') return null
  if (s === '3A' || s.startsWith('3A')) return 'g13'
  return HEADER_TO_GAME[s] ?? null
}

const buf = readFileSync(xlsxPath)
const wb = XLSX.read(buf, { type: 'buffer' })
const sh = wb.Sheets[wb.SheetNames[0] ?? ''] 
if (!sh) {
  console.error('No sheet found')
  process.exit(1)
}
const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null })
const hrow = aoa[0] || []

const colToGame = new Map()
for (let c = 0; c < hrow.length; c++) {
  if (c === 0) continue
  if (c === 1) continue
  const gid = headerToGameId(hrow[c])
  if (gid) {
    if (colToGame.has(c) && colToGame.get(c) !== gid) {
      console.error('Header conflict at column', c, hrow[c])
    }
    colToGame.set(c, gid)
  }
}

if (colToGame.size < 15) {
  console.warn('Expected 15 pick columns, got', colToGame.size, colToGame)
}

const players = []
for (let r = 1; r < aoa.length; r++) {
  const row = aoa[r] || []
  const nameCell = row[1]
  if (nameCell == null || String(nameCell).trim() === '') continue
  const num = row[0] != null ? String(row[0]) : `row-${r}`
  const name = String(nameCell).trim()
  if (name === 'Name' || /vs\.?/i.test(String(row[2] || ''))) continue
  const picks = {}
  for (const [c, gameId] of colToGame) {
    const v = row[c]
    if (v == null || String(v).trim() === '') {
      picks[gameId] = null
    } else {
      picks[gameId] = String(v).trim().toUpperCase()
    }
  }
  players.push({ id: String(num), name, picks })
}

const out = {
  $schemaNote: 'Regenerate: npm run participants:from-excel',
  source: relative(root, xlsxPath).replaceAll('\\', '/'),
  players,
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log('Wrote', outPath, '—', players.length, 'participants')
