// Which fraction of the FFT bins each line reads. The top octaves (above ~B2)
// are near-silent on most music, so they're deliberately ignored.
export interface Split { low: number; high: number }

// Not implemented yet (TDD red step).
export function splitSpectrum(_data: ArrayLike<number>): Split {
  return { low: 0, high: 0 }
}
