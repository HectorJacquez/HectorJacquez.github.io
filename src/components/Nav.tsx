import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from './Brand'
import { useSectionLink } from './useSectionLink'

/** Top navigation. On narrow screens the links collapse behind a menu button
 *  that closes on selection or an outside click. Section links (Music/Games/
 *  Work) scroll the home page instead of overwriting the router hash. */
export function Nav() {
  const [open, setOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const close = () => setOpen(false)
  const sectionLink = useSectionLink()
  const section = (id: string) => sectionLink(id, close)

  // close the open mobile menu when tapping/clicking anywhere outside the nav
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <nav className="top" ref={navRef}>
      <div className="wrap">
        <Brand />
        <span className="spacer" />
        <button
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="bars" aria-hidden="true" />
        </button>
        <div className={open ? 'nav-links open' : 'nav-links'}>
          <a className="item" href="#experience" onClick={section('experience')}>Work</a>
          <Link className="item" to="/bio" onClick={close}>About</Link>
          <a className="item" href="#music" onClick={section('music')}>Music</a>
          <a className="item" href="#games" onClick={section('games')}>Games</a>
          <Link className="item" to="/story" onClick={close}>Server Story</Link>
          <Link className="item" to="/listening" onClick={close}>Listening</Link>
        </div>
      </div>
    </nav>
  )
}
