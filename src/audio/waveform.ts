export interface WaveFracOpts {
  /** Driven by the audio when true; a quiet idle shimmer when false. */
  live: boolean
  /** 0..1 auto-gained energy of this line's band. */
  energy?: number
  /** 0..1 per-band detail bump for local spectrum shape. */
  mag?: number
  /** Multiplies the detail bump so the two lines weave apart. */
  boost?: number
}

/** Signed horizontal excursion of a wave point, as a fraction of canvas width.
 *  Kept well under the ~0.28 border distance so a loud peak swings instead of
 *  pinning flat to the edge, and energy is the dominant term so the swing size
 *  tracks the music rather than the idle wobble. */
export function waveFrac(wob: number, opts: WaveFracOpts): number {
  if (!opts.live) return wob * 0.02
  const energy = opts.energy ?? 0
  const mag = opts.mag ?? 0
  const boost = opts.boost ?? 1
  return wob * (0.02 + energy * 0.07 + mag * 0.015 * boost)
}

/** Place a wave point horizontally, clamped inside the canvas border so a loud
 *  band can never push the line past its container. */
export function clampX(base: number, dir: number, frac: number, width: number): number {
  const x = base + dir * frac * width
  return Math.max(2, Math.min(width - 2, x))
}
