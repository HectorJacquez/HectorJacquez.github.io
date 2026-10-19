import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Nav } from './Nav'

const renderNav = () => render(<MemoryRouter><Nav /></MemoryRouter>)

describe('Nav', () => {
  it('starts with the mobile menu collapsed', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the menu when the toggle is clicked', async () => {
    renderNav()
    const toggle = screen.getByRole('button', { name: /menu/i })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the menu again when a link is chosen', async () => {
    renderNav()
    const toggle = screen.getByRole('button', { name: /menu/i })
    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole('link', { name: 'Music' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
