export interface AutoGainOpts {
  /** How fast the tracked peak decays each frame when the signal is quieter. */
  decay?: number
  /** Smallest divisor, so near-silence can't explode the gain. */
  floor?: number
}

export interface AutoGainResult {
  /** 0..1 normalized level: 1 at the signal's own recent peak. */
  gain: number
  /** The updated peak, fed back in on the next frame. */
  peak: number
}

/**
 * Normalize a live signal to its own recent loudness so a quiet track still
 * reaches full swing. Track a slowly-decaying peak and divide against it.
 */
export function autoGain(value: number, peak: number, opts: AutoGainOpts = {}): AutoGainResult {
  const decay = opts.decay ?? 0.992
  const floor = opts.floor ?? 0.02
  const nextPeak = Math.max(value, peak * decay)
  const gain = Math.min(1, value / Math.max(nextPeak, floor))
  return { gain, peak: nextPeak }
}
