import { describe, it, expect } from 'vitest'
import { stepSpring, isSettled, type SpringState } from './spring'

const FRAME = 1 / 60

function run(s: SpringState, target: number, frames: number): SpringState {
  for (let i = 0; i < frames; i++) s = stepSpring(s, target, FRAME)
  return s
}

describe('stepSpring', () => {
  it('settles on the target', () => {
    const s = run({ x: 0, v: 0 }, 5, 180)
    expect(Math.abs(s.x - 5)).toBeLessThan(0.01)
    expect(isSettled(s, 5)).toBe(true)
  })

  it('overshoots slightly, like a real spring, without flying off', () => {
    let s: SpringState = { x: 0, v: 0 }
    let peak = 0
    for (let i = 0; i < 120; i++) {
      s = stepSpring(s, 5, FRAME)
      peak = Math.max(peak, s.x)
    }
    expect(peak).toBeGreaterThan(5)
    expect(peak).toBeLessThan(6)
  })

  it('keeps its momentum when the target changes mid-flight', () => {
    const moving = run({ x: 0, v: 0 }, 5, 6)
    expect(moving.v).toBeGreaterThan(0)
    const next = stepSpring(moving, 0, FRAME)
    expect(next.x).toBeGreaterThan(moving.x)
  })

  it('clamps a huge frame gap so a backgrounded tab cannot explode it', () => {
    const s = { x: 0, v: 0 }
    expect(stepSpring(s, 5, 10)).toEqual(stepSpring(s, 5, 1 / 30))
  })
})
