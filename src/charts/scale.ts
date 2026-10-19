/** Map a value from a data domain onto a pixel range. The range may be
 *  inverted (r0 > r1), which is how SVG y-axes point upward. */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  return (_v: number): number => 0
}

/** A "nice" axis step (1, 2, or 5 times a power of ten) that splits `max` into
 *  roughly `target` gridlines. */
export function niceStep(_max: number, _target = 3): number {
  return 0
}

export interface Axis {
  step: number
  top: number
  ticks: number[]
}

/** Nice axis: a rounded top at or above `max`, with evenly spaced gridlines. */
export function axisTicks(_max: number, _target = 3): Axis {
  return { step: 0, top: 0, ticks: [] }
}
