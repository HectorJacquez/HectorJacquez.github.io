import { useEffect, useRef, type MouseEvent, type TouchEvent } from 'react'
import { stepSpring, isSettled, type SpringState } from '../motion/spring'

const REST: SpringState = { x: 0, v: 0 }

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/** Pointer-driven tilt that follows the cursor on two damped springs, so it keeps
 *  its momentum when interrupted and settles back with a small overshoot. */
export function useSpringTilt<T extends HTMLElement>(maxDeg: number) {
  const ref = useRef<T>(null)
  const target = useRef({ rx: 0, ry: 0 })
  const rx = useRef(REST)
  const ry = useRef(REST)
  const frame = useRef(0)
  const lastT = useRef<number | null>(null)
  const lastTouch = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function paint(el: T, x: number, y: number) {
    el.style.setProperty('--rx', `${x.toFixed(3)}deg`)
    el.style.setProperty('--ry', `${y.toFixed(3)}deg`)
  }

  function clear(el: T) {
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
  }

  function tick(t: number) {
    const el = ref.current
    if (!el) { frame.current = 0; return }
    const dt = lastT.current === null ? 1 / 60 : (t - lastT.current) / 1000
    lastT.current = t
    const goal = target.current
    rx.current = stepSpring(rx.current, goal.rx, dt)
    ry.current = stepSpring(ry.current, goal.ry, dt)
    if (isSettled(rx.current, goal.rx) && isSettled(ry.current, goal.ry)) {
      rx.current = { x: goal.rx, v: 0 }
      ry.current = { x: goal.ry, v: 0 }
      if (goal.rx === 0 && goal.ry === 0) clear(el)
      else paint(el, goal.rx, goal.ry)
      frame.current = 0
      lastT.current = null
      return
    }
    paint(el, rx.current.x, ry.current.x)
    frame.current = requestAnimationFrame(tick)
  }

  function wake() {
    if (frame.current) return
    lastT.current = null
    frame.current = requestAnimationFrame(tick)
  }

  function aim(clientX: number, clientY: number) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (clientX - r.left) / r.width
    const y = (clientY - r.top) / r.height
    target.current = { rx: (y - 0.5) * -maxDeg, ry: (x - 0.5) * maxDeg }
    if (prefersReducedMotion()) paint(el, target.current.rx, target.current.ry)
    else wake()
  }

  function release() {
    target.current = { rx: 0, ry: 0 }
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) clear(el)
    else wake()
  }

  return {
    ref,
    handlers: {
      onMouseMove: (e: MouseEvent) => {
        // touch devices fire a synthetic mousemove after touchend; ignore it
        if (Date.now() - lastTouch.current < 500) return
        aim(e.clientX, e.clientY)
      },
      onMouseLeave: release,
      onTouchMove: (e: TouchEvent) => {
        const t = e.touches[0]
        if (t) aim(t.clientX, t.clientY)
      },
      onTouchEnd: () => {
        lastTouch.current = Date.now()
        release()
      },
    },
  }
}
