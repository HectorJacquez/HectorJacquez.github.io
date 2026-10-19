import { describe, it, expect } from 'vitest'
import { scaleLinear, niceStep, axisTicks } from './scale'

describe('scaleLinear', () => {
  it('maps the domain endpoints onto the range endpoints', () => {
    const s = scaleLinear(0, 10, 0, 100)
    expect(s(0)).toBe(0)
    expect(s(10)).toBe(100)
    expect(s(5)).toBe(50)
  })

  it('supports an inverted range, as an SVG y-axis needs', () => {
    const y = scaleLinear(0, 100, 200, 0) // value 0 at the bottom (y=200), 100 at the top (y=0)
    expect(y(0)).toBe(200)
    expect(y(100)).toBe(0)
    expect(y(50)).toBe(100)
  })
})

describe('niceStep', () => {
  it('picks a 1/2/5 x 10^k step sized to the target gridline count', () => {
    expect(niceStep(14608, 3)).toBe(5000)
    expect(niceStep(1000, 2)).toBe(500)
    expect(niceStep(3345, 3)).toBe(2000) // rounds the step up, so at most `target` gridlines
  })
})

describe('axisTicks', () => {
  it('rounds the top up to a nice multiple and lists the gridlines', () => {
    expect(axisTicks(14608, 3)).toEqual({ step: 5000, top: 15000, ticks: [5000, 10000, 15000] })
  })

  it('never leaves the max above the top gridline', () => {
    const a = axisTicks(3345, 3)
    expect(a.top).toBeGreaterThanOrEqual(3345)
    expect(a.ticks[a.ticks.length - 1]).toBe(a.top)
  })
})
