/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

// Navigation is hash-driven; jsdom dispatches `hashchange` asynchronously, so
// page transitions are awaited via findBy* rather than asserted synchronously.
describe('App navigation and Win % tab', () => {
  beforeEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })
  afterEach(() => {
    cleanup()
    window.location.hash = ''
  })

  it('shows three nav tabs including Win %', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: /page navigation/i })
    within(nav).getByRole('button', { name: /public results/i })
    within(nav).getByRole('button', { name: /win %/i })
    within(nav).getByRole('button', { name: /^admin$/i })
  })

  it('opens the Win % tab and renders the projection table', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: /page navigation/i })
    fireEvent.click(within(nav).getByRole('button', { name: /win %/i }))

    await screen.findByRole('heading', { level: 1, name: /^win percentage$/i })
    expect(
      screen.getByRole('heading', { name: /^projected standings$/i }),
    ).toBeInTheDocument()

    const table = screen.getByRole('table')
    within(table).getByRole('columnheader', { name: /^rank$/i })
    within(table).getByRole('columnheader', { name: /^name$/i })
    within(table).getByRole('columnheader', { name: /^pts$/i })
    within(table).getByRole('columnheader', { name: /chance to win/i })
    within(table).getByRole('columnheader', { name: /accuracy/i })

    // Real pool data renders rows with a champion percentage.
    expect(within(table).getAllByText(/%/).length).toBeGreaterThan(0)
    within(table).getByText('Jay')
  })

  it('switches back to Public results from the Win % tab', async () => {
    window.location.hash = '#win'
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: /^win percentage$/i }),
    ).toBeInTheDocument()

    const nav = screen.getByRole('navigation', { name: /page navigation/i })
    fireEvent.click(within(nav).getByRole('button', { name: /public results/i }))

    await screen.findByRole('heading', { name: /stanley cup pool results/i })
  })
})
