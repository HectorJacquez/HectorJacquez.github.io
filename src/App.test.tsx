import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('keeps the music player mounted across a route change', async () => {
    render(<App />)
    const before = screen.getByTestId('music-player')
    await userEvent.click(screen.getAllByRole('link', { name: /the story/i })[0])
    screen.getByRole('heading', { name: /the story/i })      // route content changed
    expect(screen.getByTestId('music-player')).toBe(before)  // but the player persisted
  })
})
