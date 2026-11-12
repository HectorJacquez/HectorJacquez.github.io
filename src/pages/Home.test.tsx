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
    expect(screen.getByText('AutoCharter')).toBeTruthy()
    expect(screen.getByText('pullqueue')).toBeTruthy()
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

  it('marks the forks that live on GitHub with the GitHub logo', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const feishin = screen.getAllByRole('link', { name: 'Feishin fork on GitHub' })[0]
    expect(feishin).toHaveAttribute('href', expect.stringContaining('github.com/HectorJacquez/feishin'))
    expect(feishin.querySelector('svg.gh')).not.toBeNull()
  })

  it('links the Angular listening demo to its GitHub repo', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    const listening = screen.getAllByRole('link', { name: 'Listening (Angular) on GitHub' })[0]
    expect(listening).toHaveAttribute('href', 'https://github.com/HectorJacquez/listening-angular')
    expect(listening.querySelector('svg.gh')).not.toBeNull()
  })

  it('lists the chips with a GitHub repo first', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    const minis = [...container.querySelectorAll('#work .mini')]
    const linked = minis.map((m) => m.querySelector('svg.gh') !== null)
    expect(linked.slice(0, 3)).toEqual([true, true, true])
    expect(linked.slice(3)).not.toContain(true)
  })

  it('shows the server projects as chips, not big cards', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    expect(container.querySelector('#work .card')).toBeNull()
    expect(container.querySelector('#music .card')).toBeNull()
  })

  it('no longer lists Pocket Trace Recorder', () => {
    render(<MemoryRouter><Home /></MemoryRouter>)
    expect(screen.queryByText('Pocket Trace Recorder')).toBeNull()
  })
})
