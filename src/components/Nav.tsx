import { Link } from 'react-router-dom'
import { Brand } from './Brand'

/** Top navigation. On narrow screens the links collapse behind a menu button. */
export function Nav() {
  return (
    <nav className="top">
      <div className="wrap">
        <Brand />
        <span className="spacer" />
        <button className="nav-toggle" aria-label="Menu" aria-expanded={false}>
          <span className="bars" aria-hidden="true" />
        </button>
        <div className="nav-links">
          <a className="item" href="#music">Music</a>
          <a className="item" href="#games">Games</a>
          <a className="item" href="#work">Work</a>
          <Link className="item" to="/story">The Story</Link>
          <Link className="item" to="/listening">Listening</Link>
          <a className="item external" href="https://hedge-at-hog.neocities.org/">The Fun Site</a>
        </div>
      </div>
    </nav>
  )
}
