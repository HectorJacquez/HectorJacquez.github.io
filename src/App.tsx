import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { Brand } from './components/Brand'

function MusicPlayer() {
  return <audio data-testid="music-player" src={`${import.meta.env.BASE_URL}media/water.mp3`} preload="none" />
}

function Nav() {
  return (
    <nav className="top">
      <div className="wrap">
        <Brand />
        <span className="spacer" />
        <a className="item" href="#music">Music</a>
        <a className="item" href="#games">Games</a>
        <a className="item" href="#work">Work</a>
        <Link className="item" to="/story">The Story</Link>
        <Link className="item" to="/listening">Listening</Link>
        <a className="item" href="https://hedge-at-hog.neocities.org/">The Fun Site</a>
      </div>
    </nav>
  )
}

function Home() {
  return (
    <header className="hero">
      <div className="wrap">
        <div className="hero-text">
          <h1 className="kicker">Fullstack Software Engineer</h1>
          <p className="lede">
            I'm a fullstack software engineer with seven years of experience, most of
            it remote. The last four years I worked fullstack in Java and Sencha ExtJS
            along with SQL Server, and before that three years in C# and .NET on banking
            software. I use AI coding tools carefully in my day to day work, and in my
            own time I build around the things I care about, mostly music, art, and games.
          </p>
          <p className="openwork">I'm looking for my next fullstack role, remote preferred.</p>
          <div className="cta-row">
            <a className="btn primary" href="#music">See my work</a>
            <Link className="btn" to="/story">The story</Link>
            <a className="btn" href="mailto:hector.jacquez@outlook.com">Email me</a>
            <a className="btn" href="https://www.linkedin.com/in/hector-jacquez-a13829141">LinkedIn</a>
            <a className="btn" href="https://github.com/HectorJacquez">GitHub</a>
          </div>
        </div>
      </div>
    </header>
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
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/story" element={<Stub title="The Story" />} />
        <Route path="/listening" element={<Stub title="Listening" />} />
      </Routes>
      <MusicPlayer />
    </HashRouter>
  )
}
