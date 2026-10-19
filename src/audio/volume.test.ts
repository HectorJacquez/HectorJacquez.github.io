import { describe, it, expect } from 'vitest'
import { volumeFromDrag } from './volume'

describe('volumeFromDrag', () => {
  it('leaves volume unchanged with no drag', () => {
    expect(volumeFromDrag(0.5, 0)).toBeCloseTo(0.5, 5)
  })
  it('dragging up (negative dy) raises volume', () => {
    expect(volumeFromDrag(0.3, -75, 150)).toBeCloseTo(0.8, 5)
  })
  it('dragging down (positive dy) lowers volume', () => {
    expect(volumeFromDrag(0.7, 75, 150)).toBeCloseTo(0.2, 5)
  })
  it('clamps at 1', () => {
    expect(volumeFromDrag(0.9, -300, 150)).toBe(1)
  })
  it('clamps at 0', () => {
    expect(volumeFromDrag(0.1, 300, 150)).toBe(0)
  })
})
