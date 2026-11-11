import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Play } from './Play'

describe('Play', () => {
  it('hosts the Godot export in a frame with the manual beside it', () => {
    render(<Play />)
    const frame = screen.getByTitle("Nico's Bizarre Adventure")
    expect(frame.getAttribute('src')).toMatch(/play\/cat-rpg\/index\.html$/)
    expect(screen.getByText('Controls')).toBeTruthy()
    expect(screen.getByText('swap leader')).toBeTruthy()
  })
})
