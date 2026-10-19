/** Per-frame envelope follower: ease `current` toward `target`, faster when
 *  rising (attack) than falling (release), so the visualizer winds up smoothly
 *  when sound comes in and eases back down when it fades. Rates are 0..1 per
 *  frame (fraction of the remaining gap to close). */
export function envelopeFollower(current: number, target: number, attack = 0.08, release = 0.04): number {
  const rate = target > current ? attack : release
  return current + (target - current) * rate
}
