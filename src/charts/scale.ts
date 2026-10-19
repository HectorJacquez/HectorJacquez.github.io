/** Map a value from a data domain onto a pixel range. The range may be
 *  inverted (r0 > r1), which is how SVG y-axes point upward. */
export function scaleLinear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1
  return (v: number): number => r0 + ((v - d0) / span) * (r1 - r0)
}

/** A "nice" axis step (1, 2, or 5 times a power of ten) that splits `max` into
 *  roughly `target` gridlines. */
export function niceStep(max: number, target = 3): number {
  const rough = max / target
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag // 1..10
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

export interface Axis {
  step: number
  top: number
  ticks: number[]
}

/** Nice axis: a rounded top at or above `max`, with evenly spaced gridlines. */
export function axisTicks(max: number, target = 3): Axis {
  const step = niceStep(max, target)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = step; t <= top + step / 2; t += step) ticks.push(t)
  return { step, top, ticks }
}
