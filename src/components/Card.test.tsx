import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Card } from './Card'

const project = {
  title: 'Test Project',
  tag: 'eng',
  body: 'A test project description.',
  pills: ['React', 'TS'],
  links: [{ href: 'https://example.com', text: 'Demo' }],
}

describe('Card', () => {
  it('renders a shift-border element inside the card', () => {
    const { container } = render(<Card p={project} />)
    expect(container.querySelector('.card .shift-border')).not.toBeNull()
  })

  describe('spring tilt', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] }) })
    afterEach(() => { vi.useRealTimers() })

    function setup() {
      const { container } = render(<Card p={project} />)
      const card = container.querySelector('.card') as HTMLElement
      card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => {} })
      return card
    }
    const rx = (el: HTMLElement) => el.style.getPropertyValue('--rx')

    it('eases the tilt in over a few frames instead of jumping', () => {
      const card = setup()
      fireEvent.mouseMove(card, { clientX: 180, clientY: 40 })
      expect(rx(card)).toBe('')
      vi.advanceTimersByTime(400)
      expect(parseFloat(rx(card))).toBeGreaterThan(1)
      expect(parseFloat(card.style.getPropertyValue('--ry'))).toBeGreaterThan(1)
    })

    it('springs back after the pointer leaves, then clears', () => {
      const card = setup()
      fireEvent.mouseMove(card, { clientX: 180, clientY: 40 })
      vi.advanceTimersByTime(400)
      fireEvent.mouseLeave(card)
      expect(rx(card)).not.toBe('')
      vi.advanceTimersByTime(3000)
      expect(rx(card)).toBe('')
      expect(card.style.getPropertyValue('--ry')).toBe('')
    })

    it('springs back and clears after a touch ends', () => {
      const card = setup()
      fireEvent.touchMove(card, { touches: [{ clientX: 180, clientY: 40 }] })
      vi.advanceTimersByTime(400)
      expect(parseFloat(rx(card))).toBeGreaterThan(1)
      fireEvent.touchEnd(card)
      vi.advanceTimersByTime(3000)
      expect(rx(card)).toBe('')
    })
  })
})
