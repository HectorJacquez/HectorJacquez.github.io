import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home'
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
        <a href="https://hedge-at-hog.neocities.org/">Hedge@hog on Neocities</a>
      </div>
    </footer>
  )
}

const Stub = ({ title }: { title: string }) => (
  <main className="wrap" style={{ padding: '3rem 1.4rem' }}>
    <h1>{title}</h1>
    <p>Coming to the React rebuild soon.</p>
  </main>
)

export default function App() {
  return (
    <HashRouter>
      <Visualizer />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Stub title="The Story" />} />
        <Route path="/listening" element={<Stub title="Listening" />} />
      </Routes>
      <Footer />
      <MusicDot />
    </HashRouter>
  )
}
