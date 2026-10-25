/** 2 = bloom + vignette + MSAA, 1 = no effects pass (native AA), 0 = that at 1x density. */
export type Quality = 0 | 1 | 2

export function stepQuality(q: Quality, ev: 'decline' | 'incline' | 'fallback'): Quality {
  if (ev === 'fallback') return 0
  if (ev === 'decline') return Math.max(0, q - 1) as Quality
  return Math.min(2, q + 1) as Quality
}

/** `?quality=0|1|2` forces a level, so a fast machine can preview what slow ones get. */
export function qualityOverride(search: string): Quality | null {
  const v = new URLSearchParams(search).get('quality')
  return v === '0' || v === '1' || v === '2' ? (Number(v) as Quality) : null
}
