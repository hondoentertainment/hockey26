/**
 * Fetches the official nhle.com playoff-bracket JSON (Node) for CI or local inspection.
 * Usage: node scripts/fetch-nhl-bracket.mjs [YEAR]   (default: 2026)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const year = process.argv[2] ?? '2026'
const url = `https://api-web.nhle.com/v1/playoff-bracket/${year}`
const res = await fetch(url)
if (!res.ok) {
  console.error(res.status, await res.text())
  process.exit(1)
}
const j = await res.text()
const __d = dirname(fileURLToPath(import.meta.url))
const outDir = join(__d, '../public')
await mkdir(outDir, { recursive: true })
const out = join(outDir, `nhl-bracket-${year}.json`)
await writeFile(out, j, 'utf8')
console.log('Wrote', out)
