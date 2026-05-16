import { describe, expect, it } from 'vitest'
import {
  GAMES,
  allGameIds,
  getGameById,
  teamByAbbr,
} from './bracket-2026'
import type { BracketGame } from './bracketTypes'
import type { ParticipantsFile } from './participantsFromExcel.schema'
import poolFile from './participantsFromExcel.json' with { type: 'json' }
import officialResultsBaseline from './officialResultsBaseline.json' with { type: 'json' }
import seriesScoresRaw from './seriesScoresBaseline.json' with { type: 'json' }
import {
  coerceOfficialResultsByFeeds,
  getSlotTeams,
} from '../lib/bracketResolve'
import type { Picks } from './bracketTypes'

const ALLOWED_ABBRS = new Set(teamByAbbr.keys())
const GAME_ID_SET = new Set(allGameIds)

function isSchemaNoteKey(k: string): boolean {
  return k.startsWith('$')
}

/** Uppercase NHL-style abbreviations only (pool + baselines use this form). */
function assertValidAbbr(v: string, label: string): void {
  expect(v, `${label}: "${v}"`).toMatch(/^[A-Z0-9]{2,4}$/)
  expect(ALLOWED_ABBRS.has(v), `${label}: unknown team "${v}"`).toBe(true)
}

function officialPicksFromJson(
  raw: Record<string, unknown>,
): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (isSchemaNoteKey(k)) continue
    out[k] =
      v == null || v === ''
        ? null
        : typeof v === 'string'
          ? v
          : String(v)
  }
  return out
}

function seriesEntries(): [string, { topWins: number; bottomWins: number }][] {
  const raw = seriesScoresRaw as Record<string, unknown>
  const out: [string, { topWins: number; bottomWins: number }][] = []
  for (const [k, v] of Object.entries(raw)) {
    if (isSchemaNoteKey(k)) continue
    expect(GAME_ID_SET.has(k), `seriesScores: unknown game "${k}"`).toBe(true)
    expect(typeof v, `seriesScores ${k}`).toBe('object')
    expect(v).not.toBeNull()
    const o = v as Record<string, unknown>
    expect(Number.isInteger(o.topWins), `${k} topWins`).toBe(true)
    expect(Number.isInteger(o.bottomWins), `${k} bottomWins`).toBe(true)
    const topWins = o.topWins as number
    const bottomWins = o.bottomWins as number
    expect(topWins).toBeGreaterThanOrEqual(0)
    expect(topWins).toBeLessThanOrEqual(4)
    expect(bottomWins).toBeGreaterThanOrEqual(0)
    expect(bottomWins).toBeLessThanOrEqual(4)
    expect(topWins + bottomWins, `${k} games played`).toBeLessThanOrEqual(7)
    out.push([k, { topWins, bottomWins }])
  }
  return out
}

describe('shipped participants (Excel import)', () => {
  const file = poolFile as ParticipantsFile & Record<string, unknown>

  it('has players and unique ids', () => {
    const players = file.players ?? []
    expect(players.length).toBeGreaterThan(0)
    const ids = players.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('defaultPicksPlayerId points at an existing player when set', () => {
    const players = file.players ?? []
    const d = file.defaultPicksPlayerId
    if (d == null || d === '') return
    expect(players.some((p) => p.id === d)).toBe(true)
  })

  it('every player has exactly the bracket game ids and valid pick abbrs', () => {
    for (const p of file.players ?? []) {
      expect(p.id?.trim(), `player id`).toBeTruthy()
      expect(p.name?.trim(), `player ${p.id} name`).toBeTruthy()
      const picks = p.picks ?? {}
      const keys = Object.keys(picks).filter((k) => !isSchemaNoteKey(k))
      expect(keys.length, `${p.name} pick count`).toBe(allGameIds.length)
      expect(new Set(keys).size).toBe(allGameIds.length)
      for (const id of allGameIds) {
        expect(id in picks, `${p.name} missing ${id}`).toBe(true)
        const v = picks[id]
        if (v == null || v === '') continue
        expect(typeof v, `${p.name} ${id}`).toBe('string')
        assertValidAbbr(v, `${p.name} ${id}`)
      }
    }
  })
})

describe('shipped official results baseline', () => {
  const raw = officialResultsBaseline as Record<string, unknown>
  const picks = officialPicksFromJson(raw)

  it('only contains known game ids (no stray keys)', () => {
    for (const k of Object.keys(picks)) {
      expect(GAME_ID_SET.has(k), `officialResults unknown key "${k}"`).toBe(
        true,
      )
    }
  })

  it('non-null winners use real team codes; R1 winners match that matchup', () => {
    for (const id of allGameIds) {
      const w = picks[id]
      if (w == null || w === '') continue
      assertValidAbbr(w, `official ${id}`)
      const g = getGameById(id)
      expect(g).toBeDefined()
      if (g!.kind === 'r1') {
        expect(
          w === g.top.abbr || w === g.bottom.abbr,
          `official ${id}: "${w}" not in ${g.top.abbr} vs ${g.bottom.abbr}`,
        ).toBe(true)
      }
    }
  })

  it('KO slots: no winner while a feeder is still undecided (after feed coercion)', () => {
    const coerced = coerceOfficialResultsByFeeds(picks as Picks)
    for (const g of GAMES) {
      if (g.kind !== 'ko') continue
      const { top, bottom } = getSlotTeams(g, coerced)
      const w = coerced[g.id] ?? null
      if (top == null || bottom == null) {
        expect(
          w == null || w === '',
          `${g.id}: winner set but slot not fully resolved`,
        ).toBe(true)
      } else if (w != null && w !== '') {
        expect(
          w === top.abbr || w === bottom.abbr,
          `${g.id}: winner "${w}" not ${top.abbr} vs ${bottom.abbr}`,
        ).toBe(true)
      }
    }
  })
})

describe('shipped series scores baseline', () => {
  const seriesList = seriesEntries()

  it('entries are well-formed and keyed by real games', () => {
    expect(seriesList.length).toBeGreaterThan(0)
  })

  it('when a series is decided (4 wins), official winner matches score orientation', () => {
    const raw = officialResultsBaseline as Record<string, unknown>
    const picks = officialPicksFromJson(raw)
    const coerced = coerceOfficialResultsByFeeds(picks as Picks)

    for (const [gid, sc] of seriesList) {
      const g = getGameById(gid) as BracketGame
      const { top, bottom } = getSlotTeams(g, coerced)
      const w = coerced[gid] ?? null

      const decided = sc.topWins === 4 || sc.bottomWins === 4
      if (!decided) continue
      expect(top && bottom, `${gid}: series decided in scores but slot empty`).toBeTruthy()

      if (sc.topWins === 4) {
        expect(
          w,
          `${gid}: series shows top won 4 but official winner missing`,
        ).toBe(top!.abbr)
      } else if (sc.bottomWins === 4) {
        expect(
          w,
          `${gid}: series shows bottom won 4 but official winner missing`,
        ).toBe(bottom!.abbr)
      }
    }
  })
})
