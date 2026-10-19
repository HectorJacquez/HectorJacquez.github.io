import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home'
import { Story } from './pages/Story'
import { Listening } from './pages/Listening'
import { MusicDot } from './components/MusicDot'
import { Visualizer } from './components/Visualizer'
import { Nav } from './components/Nav'

function Footer() {
  return (
    <footer>
      <div className="wrap">
        <span>© 2026 Hector Jacquez · <span style={{ fontFamily: 'var(--mono)', fontSize: '0.8em', color: 'var(--ink-faint)' }}>v.1</span></span>
        <a href="https://github.com/HectorJacquez">GitHub</a>
        <Link to="/story">The Story</Link>
        <Link to="/listening">Listening</Link>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Visualizer />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Story />} />
        <Route path="/listening" element={<Listening />} />
      </Routes>
      <Footer />
      <MusicDot />
    </HashRouter>
  )
}
