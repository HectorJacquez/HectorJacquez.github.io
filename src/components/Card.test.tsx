import { describe, it, expect } from 'vitest'
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

  it('sets tilt CSS variables on mouse move', () => {
    const { container } = render(<Card p={project} />)
    const card = container.querySelector('.card')!
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => {} })
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 })
    expect(card.style.getPropertyValue('--rx')).toBeTruthy()
    expect(card.style.getPropertyValue('--ry')).toBeTruthy()
  })

  it('clears tilt CSS variables on mouse leave', () => {
    const { container } = render(<Card p={project} />)
    const card = container.querySelector('.card')!
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => {} })
    fireEvent.mouseMove(card, { clientX: 100, clientY: 100 })
    fireEvent.mouseLeave(card)
    expect(card.style.getPropertyValue('--rx')).toBe('')
    expect(card.style.getPropertyValue('--ry')).toBe('')
  })

  it('clears tilt on touch end', () => {
    const { container } = render(<Card p={project} />)
    const card = container.querySelector('.card')!
    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => {} })
    fireEvent.touchMove(card, { touches: [{ clientX: 100, clientY: 100 }] })
    expect(card.style.getPropertyValue('--rx')).toBeTruthy()
    fireEvent.touchEnd(card)
    expect(card.style.getPropertyValue('--rx')).toBe('')
    expect(card.style.getPropertyValue('--ry')).toBe('')
  })
})
