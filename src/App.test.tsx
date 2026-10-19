import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('keeps the music player mounted across a route change', async () => {
    render(<App />)
    const before = screen.getByTestId('music-player')
    await userEvent.click(screen.getAllByRole('link', { name: /the story/i })[0])
    screen.getByRole('heading', { level: 1, name: /wanting my own spotify/i }) // route content changed
    expect(screen.getByTestId('music-player')).toBe(before)          // but the player persisted
  })

  it('returns to the home content when an in-page section link is used from another route', async () => {
    render(<App />)
    await userEvent.click(screen.getAllByRole('link', { name: /the story/i })[0]) // -> /story
    screen.getByRole('heading', { level: 1, name: /wanting my own spotify/i })
    await userEvent.click(screen.getByRole('link', { name: 'Music' }))            // in-page section link
    // must land back on the home page, not a blank route
    expect(screen.getByRole('heading', { level: 1, name: /fullstack software engineer/i })).toBeTruthy()
  })
})
