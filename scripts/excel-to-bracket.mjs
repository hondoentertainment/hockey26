/**
 * Reads the pool Excel (default: `Hockey Tracking.xlsx` in the repo root) and
 * writes `src/config/bracketFromExcel.json` for first-round matchups in columns
 * 1A-1D (left half) and 1E-1H (right half) on the matchup label row.
 *
 * Usage: node scripts/excel-to-bracket.mjs [path/to/file.xlsx]
 */
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const __d = dirname(fileURLToPath(import.meta.url))
const root = join(__d, '..')
const xlsxPath = process.argv[2] || join(root, 'Hockey Tracking.xlsx')
const outPath = join(root, 'src', 'config', 'bracketFromExcel.json')

const buf = readFileSync(xlsxPath)
const wb = XLSX.read(buf, { type: 'buffer' })
const sh = wb.Sheets[wb.SheetNames[0] ?? ''] 
if (!sh) {
  console.error('No sheet found')
  process.exit(1)
}
const aoa = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null })
const header = (aoa[0] || []).map((c) => (c == null ? '' : String(c)).trim())
const matchRow = aoa[1] || []

function colIndex(heading) {
  const h = heading.trim()
  return header.findIndex((c) => c.trim() === h)
}

const idx1A = colIndex('1A')
const idx1B = colIndex('1B')
const idx1C = colIndex('1C')
const idx1D = colIndex('1D')
const idx1E = colIndex('1E')
const idx1F = colIndex('1F')
const idx1G = colIndex('1G')
const idx1H = colIndex('1H')

const needed = [
  ['1A', idx1A],
  ['1B', idx1B],
  ['1C', idx1C],
  ['1D', idx1D],
  ['1E/1E ', idx1E],
  ['1F', idx1F],
  ['1G', idx1G],
  ['1H', idx1H],
]
for (const [label, i] of needed) {
  if (i < 0) {
    console.error('Missing column for', label, '— headers:', header)
    process.exit(1)
  }
}

const vsRe = /^\s*([A-Za-z]{2,4})\s+vs\.?\s*([A-Za-z]{2,4})\s*$/i

function parseCell(val) {
  if (val == null) return null
  const s = String(val).trim()
  if (!s) return null
  const m = s.match(vsRe)
  if (!m) {
    throw new Error(`Matchup not recognized: ${JSON.stringify(s)}`)
  }
  return [m[1].toUpperCase(), m[2].toUpperCase()]
}

const left = [
  parseCell(matchRow[idx1A]),
  parseCell(matchRow[idx1B]),
  parseCell(matchRow[idx1C]),
  parseCell(matchRow[idx1D]),
]
const right = [
  parseCell(matchRow[idx1E]),
  parseCell(matchRow[idx1F]),
  parseCell(matchRow[idx1G]),
  parseCell(matchRow[idx1H]),
]

const out = {
  $schemaNote:
    'Generated from the pool Excel. Regenerate: npm run bracket:from-excel',
  source: relative(root, xlsxPath).replaceAll('\\', '/'),
  left,
  right,
}

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log('Wrote', outPath)
