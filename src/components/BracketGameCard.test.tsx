/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGameById } from '../config/bracket-2026'
import { BracketGameCard } from './BracketGameCard'

describe('BracketGameCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders first round labels and abbrs', () => {
    const g = getGameById('g1')
    if (!g) throw new Error('g1')
    const onPick = vi.fn()
    render(
      <BracketGameCard
        game={g}
        state={{}}
        mode="picks"
        onPick={onPick}
      />,
    )
    expect(screen.getByText(/first round/i)).toBeInTheDocument()
    expect(screen.getByText('COL')).toBeInTheDocument()
    expect(screen.getByText('LAK')).toBeInTheDocument()
  })

  it('calls onPick with game id and abbr when a team is chosen', () => {
    const g = getGameById('g1')
    if (!g) throw new Error('g1')
    const onPick = vi.fn()
    render(
      <BracketGameCard
        game={g}
        state={{}}
        mode="picks"
        onPick={onPick}
      />,
    )
    fireEvent.click(screen.getByTitle('Avalanche'))
    expect(onPick).toHaveBeenCalledWith('g1', 'COL')
  })
})
