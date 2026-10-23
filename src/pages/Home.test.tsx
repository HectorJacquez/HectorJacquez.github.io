import { describe, expect, it } from 'vitest'
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

  it('renders shift-border elements inside mini cards', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    const minis = container.querySelectorAll('.mini')
    expect(minis.length).toBeGreaterThan(0)
    for (const mini of minis) {
      expect(mini.querySelector('.shift-border')).not.toBeNull()
    }
  })

  it('mini cards reset tilt on touch end', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    const mini = container.querySelector('.mini')!
    mini.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 60, right: 100, bottom: 60, x: 0, y: 0, toJSON: () => {} })
    fireEvent.touchMove(mini, { touches: [{ clientX: 50, clientY: 30 }] })
    expect((mini as HTMLElement).style.getPropertyValue('--rx')).toBeTruthy()
    fireEvent.touchEnd(mini)
    expect((mini as HTMLElement).style.getPropertyValue('--rx')).toBe('')
  })

  it('renders TextAnimate in the hero heading', () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>)
    expect(container.querySelector('.text-animate')).not.toBeNull()
    expect(container.querySelectorAll('.text-animate-unit').length).toBeGreaterThan(0)
  })
})
