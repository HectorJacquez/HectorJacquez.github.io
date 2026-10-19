import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTV } from './GameTV'

describe('GameTV', () => {
  it('starts powered off with no game loaded', () => {
    render(<GameTV />)
    expect(screen.getByText(/press power/i)).toBeTruthy()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('boots the game into the screen when powered on', async () => {
    render(<GameTV />)
    await userEvent.click(screen.getByRole('button', { name: /power/i }))
    const frame = document.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame!.getAttribute('src')).toMatch(/cat-rpg\/index\.html$/)
  })

  it('powers back off when pressed again', async () => {
    render(<GameTV />)
    const power = screen.getByRole('button', { name: /power/i })
    await userEvent.click(power)
    await userEvent.click(power)
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getByText(/press power/i)).toBeTruthy()
  })
})
