/** Per-frame envelope follower: ease `current` toward `target`, faster when
 *  rising (attack) than falling (release). Stub — returns current unchanged. */
export function envelopeFollower(current: number, _target: number, _attack = 0.08, _release = 0.04): number {
  return current
}
