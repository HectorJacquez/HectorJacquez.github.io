import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextAnimate } from './TextAnimate'

describe('TextAnimate', () => {
  it('renders every word of the input text', () => {
    render(<TextAnimate>Fullstack Software Engineer</TextAnimate>)
    expect(screen.getByText('Fullstack')).toBeTruthy()
    expect(screen.getByText('Software')).toBeTruthy()
    expect(screen.getByText('Engineer')).toBeTruthy()
  })

  it('wraps each word in a span with the text-animate-unit class', () => {
    const { container } = render(<TextAnimate>Hello World</TextAnimate>)
    const units = container.querySelectorAll('.text-animate-unit')
    expect(units.length).toBe(2)
    expect(units[0].textContent).toBe('Hello')
    expect(units[1].textContent).toBe('World')
  })

  it('applies staggered transition delays', () => {
    const { container } = render(<TextAnimate stagger={100}>One Two Three</TextAnimate>)
    const units = container.querySelectorAll('.text-animate-unit') as NodeListOf<HTMLElement>
    expect(units[0].style.transitionDelay).toBe('0ms')
    expect(units[1].style.transitionDelay).toBe('100ms')
    expect(units[2].style.transitionDelay).toBe('200ms')
  })

  it('renders as the specified tag', () => {
    const { container } = render(<TextAnimate as="h1">Title</TextAnimate>)
    expect(container.querySelector('h1.text-animate')).not.toBeNull()
  })
})
