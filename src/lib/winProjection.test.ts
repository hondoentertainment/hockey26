import { describe, expect, it } from 'vitest'
import { buildWinProjection } from './winProjection'
import type { BracketGame, Team } from '../config/bracketTypes'

const team = (abbr: string): Team => ({ abbr, name: abbr })

const r1 = (id: string, top: string, bottom: string): BracketGame => ({
  kind: 'r1',
  id,
  side: 'left',
  indexInRound: 0,
  round: 0,
  top: team(top),
  bottom: team(bottom),
})

const ko = (
  id: string,
  feeds: [string, string],
  round: 1 | 2 | 3,
): BracketGame => ({
  kind: 'ko',
  id,
  side: 'left',
  indexInRound: 0,
  round,
  feeds,
})

describe('buildWinProjection', () => {
  it('splits champion odds 50/50 for a single undecided series', () => {
    const games = [r1('g1', 'X', 'Y')]
    const rows = buildWinProjection(
      [
        { id: 'a', name: 'A', picks: { g1: 'X' } },
        { id: 'b', name: 'B', picks: { g1: 'Y' } },
      ],
      {},
      games,
    )
    const a = rows.find((r) => r.id === 'a')!
    const b = rows.find((r) => r.id === 'b')!
    expect(a.championPct).toBeCloseTo(0.5)
    expect(b.championPct).toBeCloseTo(0.5)
    expect(a.decidedPicks).toBe(0)
    expect(a.pickAccuracy).toBe(0)
  })

  it('reports 100% champion and full accuracy when everything is decided', () => {
    const games = [r1('g1', 'X', 'Y')]
    const rows = buildWinProjection(
      [
        { id: 'a', name: 'A', picks: { g1: 'X' } },
        { id: 'b', name: 'B', picks: { g1: 'Y' } },
      ],
      { g1: 'X' },
      games,
    )
    const a = rows.find((r) => r.id === 'a')!
    const b = rows.find((r) => r.id === 'b')!
    expect(a.championPct).toBeCloseTo(1)
    expect(a.rank).toBe(1)
    expect(a.total).toBe(1)
    expect(a.correctPicks).toBe(1)
    expect(a.pickAccuracy).toBeCloseTo(1)
    expect(b.championPct).toBeCloseTo(0)
    expect(b.correctPicks).toBe(0)
    expect(b.pickAccuracy).toBe(0)
  })

  it('resolves knockout slots from feeder winners across scenarios', () => {
    // g1: X|Y, g2: Z|W decided to Z, final g3 feeds [g1, g2].
    // Final round worth more, so the champion pick dominates. With g1 open and
    // g2 settled on Z, the four leaves are (g1∈{X,Y}) × (g3∈{g1winner, Z}).
    const games = [
      r1('g1', 'X', 'Y'),
      r1('g2', 'Z', 'W'),
      ko('g3', ['g1', 'g2'], 1),
    ]
    const rows = buildWinProjection(
      [
        { id: 'a', name: 'A', picks: { g3: 'Z' } },
        { id: 'b', name: 'B', picks: { g3: 'X' } },
      ],
      { g2: 'Z' },
      games,
    )
    // A wins whenever Z takes the final; B only when X reaches and wins it.
    const a = rows.find((r) => r.id === 'a')!
    const b = rows.find((r) => r.id === 'b')!
    expect(a.championPct + b.championPct).toBeCloseTo(1)
    expect(a.championPct).toBeGreaterThan(b.championPct)
  })

  it('counts pick accuracy over decided series only', () => {
    const games = [r1('g1', 'X', 'Y'), r1('g2', 'Z', 'W')]
    const rows = buildWinProjection(
      [{ id: 'a', name: 'A', picks: { g1: 'X', g2: 'W' } }],
      { g1: 'X', g2: 'Z' },
      games,
    )
    const a = rows.find((r) => r.id === 'a')!
    expect(a.decidedPicks).toBe(2)
    expect(a.correctPicks).toBe(1)
    expect(a.pickAccuracy).toBeCloseTo(0.5)
  })

  it('champion percentages sum to 1 across all entries', () => {
    const games = [
      r1('g1', 'X', 'Y'),
      r1('g2', 'Z', 'W'),
      ko('g3', ['g1', 'g2'], 1),
    ]
    const rows = buildWinProjection(
      [
        { id: 'a', name: 'A', picks: { g1: 'X', g3: 'X' } },
        { id: 'b', name: 'B', picks: { g2: 'Z', g3: 'Z' } },
        { id: 'c', name: 'C', picks: { g1: 'Y', g3: 'W' } },
      ],
      {},
      games,
    )
    const sum = rows.reduce((s, r) => s + r.championPct, 0)
    expect(sum).toBeCloseTo(1)
  })
})
