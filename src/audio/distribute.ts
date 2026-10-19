export interface BandDrive {
  low: number
  high: number
}

/** Split one overall loudness level between the low and high lines by their
 *  share of the current spectrum, so the louder band of the moment drives its
 *  line harder (bass -> one line, treble -> the other) instead of both tracking
 *  overall volume. `gain` is the overall level (0..1, already normalized); the
 *  high band is boosted since treble carries less raw energy than bass. */
export function distributeDrive(low: number, high: number, gain: number, highBoost = 2): BandDrive {
  const total = low + high
  if (total <= 0) return { low: 0, high: 0 }
  return {
    low: Math.min(1, gain * (low / total)),
    high: Math.min(1, gain * (high / total) * highBoost),
  }
}
