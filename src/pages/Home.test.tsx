import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Home } from './Home'

describe('Home', () => {
  it('renders the Music, Work, and Games section headings', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    screen.getByRole('heading', { name: /^music$/i })
    screen.getByRole('heading', { name: /systems and tools/i })
    screen.getByRole('heading', { name: /games and game dev/i })
    expect(screen.getByRole('heading', { name: /autocharter/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /pullqueue/i })).toBeTruthy()
  })
})
