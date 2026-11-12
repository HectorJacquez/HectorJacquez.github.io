import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Brand } from './Brand'

describe('Brand', () => {
  it('links to home and shows the name with the niko logo', () => {
    render(<MemoryRouter><Brand /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /hector jacquez/i })
    expect(link.getAttribute('href')).toBe('/')
    expect(link.querySelector('img')).not.toBeNull()
  })

  it('scrolls back to the top when clicked', async () => {
    const scrollTo = vi.fn()
    vi.stubGlobal('scrollTo', scrollTo)
    render(<MemoryRouter><Brand /></MemoryRouter>)
    await userEvent.click(screen.getByRole('link', { name: /hector jacquez/i }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    vi.unstubAllGlobals()
  })
})
