/** Map a vertical knob drag to a new volume. Drag up (negative dy) raises it. */
export function volumeFromDrag(current: number, dy: number, sensitivity = 150): number {
  return Math.max(0, Math.min(1, current - dy / sensitivity))
}
