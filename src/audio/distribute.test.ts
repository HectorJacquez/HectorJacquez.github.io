import { describe, it, expect } from 'vitest'
import { distributeDrive } from './distribute'

describe('distributeDrive', () => {
  it('is silent on both lines when there is no energy', () => {
    expect(distributeDrive(0, 0, 0)).toEqual({ low: 0, high: 0 })
  })

  it('drives the low line harder when bass dominates', () => {
    const d = distributeDrive(0.3, 0.05, 1, 1) // highBoost 1 to isolate the split
    expect(d.low).toBeGreaterThan(d.high)
  })

  it('drives the high line harder when treble dominates', () => {
    const d = distributeDrive(0.05, 0.3, 1, 1)
    expect(d.high).toBeGreaterThan(d.low)
  })

  it('reflects the spectral balance, not just overall volume', () => {
    // same overall level, different balance -> the lines must differ
    const bassy = distributeDrive(0.4, 0.1, 1, 1)
    const trebly = distributeDrive(0.1, 0.4, 1, 1)
    expect(bassy.low).toBeGreaterThan(trebly.low)
    expect(trebly.high).toBeGreaterThan(bassy.high)
  })

  it('boosts the high band so quieter treble still reads', () => {
    const plain = distributeDrive(0.2, 0.2, 1, 1)
    const boosted = distributeDrive(0.2, 0.2, 1, 2)
    expect(boosted.high).toBeGreaterThan(plain.high)
  })

  it('never exceeds full swing', () => {
    const d = distributeDrive(0.1, 0.9, 1, 3)
    expect(d.high).toBeLessThanOrEqual(1)
    expect(d.low).toBeLessThanOrEqual(1)
  })
})
