import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from './Brand'

/** Top navigation. On narrow screens the links collapse behind a menu button. */
export function Nav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <nav className="top">
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
          <a className="item" href="#music" onClick={close}>Music</a>
          <a className="item" href="#games" onClick={close}>Games</a>
          <a className="item" href="#work" onClick={close}>Work</a>
          <Link className="item" to="/story" onClick={close}>The Story</Link>
          <Link className="item" to="/listening" onClick={close}>Listening</Link>
          <a className="item external" href="https://hedge-at-hog.neocities.org/" onClick={close}>The Fun Site</a>
        </div>
      </div>
    </nav>
  )
}
