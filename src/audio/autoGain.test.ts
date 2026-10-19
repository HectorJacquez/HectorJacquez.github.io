import { describe, it, expect } from 'vitest'
import { autoGain } from './autoGain'

describe('autoGain', () => {
  it('reaches full gain when the value sits at the current peak', () => {
    expect(autoGain(0.5, 0.5).gain).toBeCloseTo(1, 5)
  })

  it('gives proportional gain below the peak', () => {
    expect(autoGain(0.25, 0.5).gain).toBeCloseTo(0.25 / 0.496, 2)
  })

  it('is silent at zero energy', () => {
    expect(autoGain(0, 0.5).gain).toBe(0)
  })

  it('decays the peak toward a quieter signal', () => {
    expect(autoGain(0.1, 0.5).peak).toBeCloseTo(0.496, 5)
  })

  it('raises the peak to a new louder value', () => {
    expect(autoGain(0.8, 0.5).peak).toBe(0.8)
  })

  it('does not explode near silence (floor caps the divisor)', () => {
    expect(autoGain(0.01, 0, { floor: 0.02 }).gain).toBeCloseTo(0.5, 5)
  })
})
