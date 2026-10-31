import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('has an About button linking to /bio', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const bio = screen.getByRole('link', { name: 'About' })
    expect(bio.getAttribute('href')).toBe('/bio')
  })

  it('has no eyebrow labels and no rainbow hover borders', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    expect(container.querySelectorAll('.kicker')).toHaveLength(0)
    expect(container.querySelectorAll('.shift-border')).toHaveLength(0)
    expect(container.querySelectorAll('.mini').length).toBeGreaterThan(0)
  })

  it('leads with a real headline rather than an eyebrow-styled title', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    const h1 = container.querySelector('.hero h1')
    expect(h1).not.toBeNull()
    expect(h1!.classList.contains('kicker')).toBe(false)
  })

  it('mini cards spring back and clear their tilt after a touch ends', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    try {
      const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
      const mini = container.querySelector('.mini') as HTMLElement
      mini.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 60, right: 100, bottom: 60, x: 0, y: 0, toJSON: () => {} })
      fireEvent.touchMove(mini, { touches: [{ clientX: 90, clientY: 10 }] })
      vi.advanceTimersByTime(400)
      expect(parseFloat(mini.style.getPropertyValue('--rx'))).toBeGreaterThan(1)
      fireEvent.touchEnd(mini)
      vi.advanceTimersByTime(3000)
      expect(mini.style.getPropertyValue('--rx')).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders TextAnimate in the hero heading', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    expect(container.querySelector('.text-animate')).not.toBeNull()
    expect(container.querySelectorAll('.text-animate-unit').length).toBeGreaterThan(0)
  })
})
