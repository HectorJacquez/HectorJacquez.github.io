import { HashRouter, Routes, Route, Link } from 'react-router-dom'

function MusicPlayer() {
  return <audio data-testid="music-player" />
}

function Home() {
  return (<main><h1>Home</h1></main>)
}

function Work() {
  return (<main><h1>Work</h1></main>)
}

export default function App() {
  return (
    <HashRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/work">Work</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/work" element={<Work />} />
      </Routes>
      {/* The persistent shell: the player lives OUTSIDE Routes, so navigating
          between pages never unmounts it. This is the whole reason for React. */}
      <MusicPlayer />
    </HashRouter>
  )
}
