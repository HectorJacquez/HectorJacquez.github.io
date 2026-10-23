import { useRef, type MouseEvent } from 'react'
import type { Project } from '../data/projects'

export function Card({ p }: { p: Project }) {
  const ref = useRef<HTMLDivElement>(null)
  const lastTouch = useRef(0)

  function applyTilt(el: HTMLDivElement, clientX: number, clientY: number) {
    const r = el.getBoundingClientRect()
    const x = (clientX - r.left) / r.width
    const y = (clientY - r.top) / r.height
    el.style.setProperty('--mx', `${x * 100}%`)
    el.style.setProperty('--my', `${y * 100}%`)
    el.style.setProperty('--rx', `${(y - 0.5) * -8}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * 8}deg`)
  }

  function onMove(e: MouseEvent) {
    if (Date.now() - lastTouch.current < 500) return
    const el = ref.current
    if (!el) return
    applyTilt(el, e.clientX, e.clientY)
  }

  function onTouch(e: React.TouchEvent) {
    const el = ref.current
    if (!el || !e.touches[0]) return
    applyTilt(el, e.touches[0].clientX, e.touches[0].clientY)
  }

  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.removeProperty('--rx')
    el.style.removeProperty('--ry')
  }

  return (
    <div className="card" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onTouchMove={onTouch} onTouchEnd={() => { lastTouch.current = Date.now(); onLeave() }}>
      <span className="shift-border" />
      <span className="tag">{p.tag}</span>
      <h3>{p.title}</h3>
      <p>{p.body}</p>
      <div className="card-foot">
        <span className="pills">{p.pills.map((x) => <span key={x} className="pill">{x}</span>)}</span>
        <span className="links">
          {p.links.map((l, i) =>
            'soon' in l ? <span key={i} className="soon">{l.soon}</span>
                        : <a key={i} href={l.href}>{l.text}</a>)}
        </span>
      </div>
    </div>
  )
}
