import { describe, it, expect } from 'vitest'
import { waveFrac, clampX } from './waveform'

// The excursion is a fraction of canvas width. The edge panes sit at 0.30/0.70
// of an ~84px-wide canvas, so the line only has ~0.28 of the width before it
// reaches a border. If the excursion exceeds that it pins to the edge (a flat
// line) and stops reading as reactive, so the amplitude must stay under it.
const MAX_SWELL = 0.28

describe('waveFrac', () => {
  it('is a small idle shimmer, scaling with the wobble', () => {
    expect(waveFrac(1, { live: false })).toBeCloseTo(0.02, 5)
    expect(waveFrac(0.5, { live: false })).toBeCloseTo(0.01, 5)
    expect(waveFrac(0, { live: false })).toBe(0)
  })

  it('has a small baseline live excursion with no energy or detail', () => {
    expect(waveFrac(1, { live: true, energy: 0, mag: 0 })).toBeCloseTo(0.02, 5)
  })

  it('swells with the band energy, and energy is the dominant driver', () => {
    const quiet = waveFrac(1, { live: true, energy: 0.1, mag: 0 })
    const loud = waveFrac(1, { live: true, energy: 0.9, mag: 0 })
    expect(loud).toBeGreaterThan(quiet)
    // a full-energy swell is several times the idle shimmer, so the music shows
    expect(waveFrac(1, { live: true, energy: 1, mag: 0 }) / waveFrac(1, { live: false })).toBeGreaterThan(3)
  })

  it('adds a boosted per-band detail bump', () => {
    const plain = waveFrac(1, { live: true, energy: 0, mag: 0.5, boost: 1 })
    const boosted = waveFrac(1, { live: true, energy: 0, mag: 0.5, boost: 1.5 })
    expect(boosted).toBeGreaterThan(plain)
  })

  it('never swells past the drawable band, so a loud peak cannot flat-line on the border', () => {
    // strongest wobble (~1.8 = 1 + 0.5 + 0.3) at full drive on every term
    const peak = Math.abs(waveFrac(1.8, { live: true, energy: 1, mag: 1.65, boost: 1.5 }))
    expect(peak).toBeLessThan(MAX_SWELL)
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
