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

  it('renders the Experience section with employment history', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    screen.getByRole('heading', { name: /where i've worked/i })
    expect(screen.getByText('ISI Software LLC')).toBeTruthy()
    expect(screen.getByText('Computer Services Inc.')).toBeTruthy()
  })

  it('renders icon buttons for Email, LinkedIn, and GitHub with aria-labels', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Email me' })).toHaveAttribute('href', 'mailto:hector.jacquez@outlook.com')
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute('href', expect.stringContaining('linkedin.com'))
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', expect.stringContaining('github.com'))
  })

  it('has a Bio button linking to /bio', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const bio = screen.getByRole('link', { name: 'Bio' })
    expect(bio.getAttribute('href')).toBe('/bio')
  })
})
