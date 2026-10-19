import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MusicDot } from './MusicDot'

describe('MusicDot', () => {
  it('toggles to a pause control when the play button is clicked', async () => {
    render(<MusicDot />)
    await userEvent.click(screen.getByRole('button', { name: /play/i }))
    expect(screen.getByRole('button', { name: /pause/i })).toBeTruthy()
  })
})
