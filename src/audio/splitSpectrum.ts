export interface Split {
  /** 0..1 average energy of the bass/low-mid band. */
  low: number
  /** 0..1 average energy of the mid/high band. */
  high: number
}

/**
 * Split the active spectrum into two bands the visualizer's two lines read.
 * The top octaves (above ~B2) are near-silent on most music, so they're
 * deliberately ignored rather than starving the high line.
 */
export function splitSpectrum(data: ArrayLike<number>): Split {
  const n = data.length
  const b1 = Math.round(n * 0.10)   // bass/low-mid cutoff (~2 kHz)
  const b2 = Math.round(n * 0.42)   // mid/high cutoff (~9 kHz)
  const avg = (lo: number, hi: number) => {
    if (hi <= lo) return 0
    let s = 0
    for (let i = lo; i < hi; i++) s += data[i]
    return s / ((hi - lo) * 255)
  }
  return { low: avg(0, b1), high: avg(b1, b2) }
}
