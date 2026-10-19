import { describe, it, expect } from 'vitest'
import { splitSpectrum } from './splitSpectrum'

const filled = (n: number, fn: (i: number) => number) =>
  Array.from({ length: n }, (_, i) => fn(i))

describe('splitSpectrum', () => {
  it('is zero for silence', () => {
    expect(splitSpectrum(new Array(100).fill(0))).toEqual({ low: 0, high: 0 })
  })

  it('is full for a maxed-out spectrum', () => {
    const { low, high } = splitSpectrum(new Array(100).fill(255))
    expect(low).toBeCloseTo(1, 5)
    expect(high).toBeCloseTo(1, 5)
  })

  it('reads the bass/low-mid band into low', () => {
    const { low, high } = splitSpectrum(filled(100, (i) => (i < 10 ? 255 : 0)))
    expect(low).toBeCloseTo(1, 5)
    expect(high).toBe(0)
  })

  it('reads the mid/high band into high', () => {
    const { low, high } = splitSpectrum(filled(100, (i) => (i >= 10 && i < 42 ? 255 : 0)))
    expect(low).toBe(0)
    expect(high).toBeCloseTo(1, 5)
  })

  it('ignores the near-silent top octaves', () => {
    expect(splitSpectrum(filled(100, (i) => (i >= 42 ? 255 : 0)))).toEqual({ low: 0, high: 0 })
  })
})
