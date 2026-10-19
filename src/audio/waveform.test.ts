import { describe, it, expect } from 'vitest'
import { waveFrac, clampX } from './waveform'

describe('waveFrac', () => {
  it('is a small constant shimmer when idle, scaling with the wobble', () => {
    expect(waveFrac(1, { live: false })).toBeCloseTo(0.12, 5)
    expect(waveFrac(0.5, { live: false })).toBeCloseTo(0.06, 5)
    expect(waveFrac(0, { live: false })).toBe(0)
  })

  it('has a baseline live excursion even with no energy or detail', () => {
    expect(waveFrac(1, { live: true, energy: 0, mag: 0 })).toBeCloseTo(0.08, 5)
  })

  it('swells with the band energy when live', () => {
    const quiet = waveFrac(1, { live: true, energy: 0.1, mag: 0 })
    const loud = waveFrac(1, { live: true, energy: 0.9, mag: 0 })
    expect(loud).toBeGreaterThan(quiet)
    expect(waveFrac(1, { live: true, energy: 1, mag: 0 })).toBeCloseTo(0.68, 5)
  })

  it('adds a boosted per-band detail bump', () => {
    const plain = waveFrac(1, { live: true, energy: 0, mag: 0.5, boost: 1 })
    const boosted = waveFrac(1, { live: true, energy: 0, mag: 0.5, boost: 1.5 })
    expect(boosted).toBeGreaterThan(plain)
  })
})

describe('clampX', () => {
  it('sits at the base line when there is no excursion', () => {
    expect(clampX(100, 1, 0, 300)).toBe(100)
  })

  it('moves in the direction given by dir', () => {
    expect(clampX(150, 1, 0.1, 300)).toBeGreaterThan(150)
    expect(clampX(150, -1, 0.1, 300)).toBeLessThan(150)
  })

  it('never pushes a point past the canvas border, however loud', () => {
    expect(clampX(150, 1, 999, 300)).toBe(298)
    expect(clampX(150, -1, 999, 300)).toBe(2)
  })
})
