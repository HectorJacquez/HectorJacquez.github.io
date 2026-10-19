import { describe, it, expect } from 'vitest'
import { envelopeFollower } from './envelope'

// Per-frame smoothing so the visualizer winds up/down gradually instead of
// snapping to the instantaneous audio level. Attack (rising) is quicker than
// release (falling), the way a musical envelope behaves.
describe('envelopeFollower', () => {
  it('eases toward a higher target at the attack rate', () => {
    expect(envelopeFollower(0, 1, 0.1, 0.05)).toBeCloseTo(0.1, 5)
  })

  it('eases toward a lower target at the release rate', () => {
    expect(envelopeFollower(1, 0, 0.1, 0.05)).toBeCloseTo(0.95, 5)
  })

  it('rises faster than it falls for the same gap', () => {
    const up = envelopeFollower(0.5, 1, 0.1, 0.05) - 0.5
    const down = 0.5 - envelopeFollower(0.5, 0, 0.1, 0.05)
    expect(up).toBeGreaterThan(down)
  })

  it('holds steady once it reaches the target', () => {
    expect(envelopeFollower(0.5, 0.5, 0.1, 0.05)).toBeCloseTo(0.5, 5)
  })

  it('converges toward the target when applied repeatedly', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = envelopeFollower(v, 1, 0.1, 0.05)
    expect(v).toBeGreaterThan(0.99)
    expect(v).toBeLessThanOrEqual(1)
  })
})
