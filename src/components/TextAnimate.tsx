import { useEffect, useRef, useState } from 'react'

/**
 * Staggered text entrance animation. Each word fades/slides in sequentially.
 * Inspired by cult-ui's text-animate. Pure CSS transitions triggered on mount.
 */
export function TextAnimate({
  children,
  as: Tag = 'span',
  className = '',
  stagger = 60,
  by = 'word',
}: {
  children: string
  as?: 'span' | 'h1' | 'h2' | 'p'
  className?: string
  stagger?: number
  by?: 'word' | 'char'
}) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      setVisible(true)
      return
    }
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const parts = by === 'char' ? children.split('') : children.split(/(\s+)/)

  let index = 0
  return (
    <Tag ref={ref as any} className={`text-animate ${className}`}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>
        const delay = index * stagger
        index++
        return (
          <span
            key={i}
            className="text-animate-unit"
            style={{
              transitionDelay: `${delay}ms`,
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(12px)',
            }}
          >
            {part}
          </span>
        )
      })}
    </Tag>
  )
}
