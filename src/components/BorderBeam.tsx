/**
 * Animated border beam — a small bright dot traces the element's border.
 * Pure CSS animation, no JS runtime. Inspired by cult-ui's border-beam.
 * Wrap any element; the beam renders as an overlay.
 */
export function BorderBeam({
  size = 80,
  duration = 6,
  delay = 0,
  color,
  className = '',
}: {
  size?: number
  duration?: number
  delay?: number
  color?: string
  className?: string
}) {
  return (
    <span
      className={`border-beam ${className}`}
      style={{
        '--beam-size': `${size}px`,
        '--beam-duration': `${duration}s`,
        '--beam-delay': `${delay}s`,
        '--beam-color': color ?? 'var(--accent)',
      } as React.CSSProperties}
    />
  )
}
