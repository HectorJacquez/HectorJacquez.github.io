export interface SpringState { x: number; v: number }
export interface SpringConfig { stiffness: number; damping: number }

// damping ratio ~0.7: follows quickly and settles with one small overshoot
export const TILT_SPRING: SpringConfig = { stiffness: 200, damping: 20 }

const MAX_DT = 1 / 30

/** One semi-implicit Euler step of a unit-mass damped spring pulling x toward target. */
export function stepSpring(s: SpringState, target: number, dt: number, cfg: SpringConfig = TILT_SPRING): SpringState {
  const h = Math.min(Math.max(dt, 0), MAX_DT)
  const a = -cfg.stiffness * (s.x - target) - cfg.damping * s.v
  const v = s.v + a * h
  return { x: s.x + v * h, v }
}

export function isSettled(s: SpringState, target: number, eps = 0.01): boolean {
  return Math.abs(s.x - target) < eps && Math.abs(s.v) < eps
}
