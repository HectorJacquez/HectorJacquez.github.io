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

/** Signed horizontal excursion of a wave point, as a fraction of canvas width. */
export function waveFrac(_wob: number, _opts: WaveFracOpts): number {
  return 0
}

/** Place a wave point horizontally, clamped inside the canvas border. */
export function clampX(_base: number, _dir: number, _frac: number, _width: number): number {
  return 0
}
