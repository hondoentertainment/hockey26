import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPicks, loadResults, savePicks } from './persistence'

function mockStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
}

describe('persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips picks', () => {
    const ls = mockStorage()
    vi.stubGlobal('localStorage', ls)
    savePicks({ g1: 'COL', g2: 'DAL' })
    const loaded = loadPicks()
    expect(loaded.g1).toBe('COL')
    expect(loaded.g2).toBe('DAL')
  })

  it('returns {} for invalid JSON', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{ not json',
      setItem: () => {},
      removeItem: () => {},
    })
    expect(loadPicks()).toEqual({})
  })

  it('returns {} for array JSON', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '[]',
      setItem: () => {},
      removeItem: () => {},
    })
    expect(loadResults()).toEqual({})
  })
})
