import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Brand } from './Brand'

describe('Brand', () => {
  it('links to home and shows the name with the niko logo', () => {
    render(<MemoryRouter><Brand /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /hector jacquez/i })
    expect(link.getAttribute('href')).toBe('/')
    expect(link.querySelector('img')).not.toBeNull()
  })
})
