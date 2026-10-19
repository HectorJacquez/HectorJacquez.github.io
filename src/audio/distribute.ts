export interface BandDrive {
  low: number
  high: number
}

/** Split one overall loudness level between the low and high lines by their
 *  share of the current spectrum, so the louder band of the moment drives its
 *  line harder (bass -> one line, treble -> the other) instead of both tracking
 *  overall volume. `gain` is the overall level (0..1, already normalized); the
 *  high band is boosted since treble carries less raw energy than bass.
 *  Stub — returns the overall level on both lines (what it does wrong today). */
export function distributeDrive(_low: number, _high: number, gain: number, _highBoost = 2): BandDrive {
  return { low: gain, high: gain }
}
