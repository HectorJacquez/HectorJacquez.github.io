import { describe, it, expect } from 'vitest'
import { waveFrac, clampX } from './waveform'

// Excursion is a fraction of canvas width. The edge panes sit at 0.30/0.70 of
// the width, so a point has ~0.29 of the width before it reaches a border.
// Idle and ordinary playing must swing freely inside that band (never a dead
// flat line); only the rare simultaneous peak may touch the edge like a big hit.
const BAND = 0.29

describe('waveFrac', () => {
  it('has a visible idle shimmer that still stays inside the band', () => {
    expect(waveFrac(1, { live: false })).toBeCloseTo(0.06, 5)
    expect(waveFrac(0, { live: false })).toBe(0)
    expect(Math.abs(waveFrac(1.8, { live: false }))).toBeLessThan(0.2) // never pins when idle
  })

  it('has a baseline live excursion matching the idle shimmer', () => {
    expect(waveFrac(1, { live: true, energy: 0, mag: 0 })).toBeCloseTo(0.06, 5)
  })

  it('swells with energy, which is the dominant driver', () => {
    const quiet = waveFrac(1, { live: true, energy: 0.1, mag: 0 })
    const loud = waveFrac(1, { live: true, energy: 0.9, mag: 0 })
    expect(loud).toBeGreaterThan(quiet)
    // full-energy swell is several times the idle shimmer, so the music clearly shows
    expect(waveFrac(1, { live: true, energy: 1, mag: 0 }) / waveFrac(1, { live: false })).toBeGreaterThan(2.5)
  })

  it('swings freely across the band during ordinary playing (no constant clamp)', () => {
    const typical = Math.abs(waveFrac(1.2, { live: true, energy: 0.7, mag: 0.5, boost: 1 }))
    expect(typical).toBeGreaterThan(0.1) // meaningful motion
    expect(typical).toBeLessThan(BAND)   // but not pinned to the border
  })

  it('stays bounded even at the absolute peak (no runaway that flat-lines constantly)', () => {
    const peak = Math.abs(waveFrac(1.8, { live: true, energy: 1, mag: 1.65, boost: 1.5 }))
    expect(peak).toBeLessThan(0.45)
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
