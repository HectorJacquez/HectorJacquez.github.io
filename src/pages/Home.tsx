import { Link, useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { TopWave } from '../components/TopWave'
import { CRT3D } from '../components/CRT3D'
import { GameTV } from '../components/GameTV'
import { useSectionLink } from '../components/useSectionLink'
import { musicCards, musicMinis, workCards, workMinis, gameCards, gameMinis, type Mini } from '../data/projects'

function Minis({ items }: { items: Mini[] }) {
  return (
    <div className="mini-grid" style={{ marginTop: '1.1rem' }}>
      {items.map((m) => (
        <div key={m.title} className="mini"><b>{m.title}</b><span>{m.note}</span></div>
      ))}
    </div>
  )
}

export function Home() {
  const toWork = useSectionLink()('work')
  const navigate = useNavigate()
  return (
    <>
      <header className="hero">
        <div className="wrap">
          <TopWave />
          <div className="hero-grid">
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
                <a className="btn primary" href="#work" onClick={toWork}>See my work</a>
                <Link className="btn" to="/story">Server story</Link>
                <a className="btn" href="mailto:hector.jacquez@outlook.com">Email me</a>
                <a className="btn" href="https://www.linkedin.com/in/hector-jacquez-a13829141">LinkedIn</a>
                <a className="btn" href="https://github.com/HectorJacquez">GitHub</a>
              </div>
            </div>
            <CRT3D onActivate={() => navigate('/paint')} />
          </div>
        </div>
      </header>

      <section id="work"><div className="wrap">
        <div className="kicker">Engineering</div>
        <h2>Systems and tools</h2>
        <p className="sub">The infrastructure behind the rest of this page. Everything above runs on these.</p>
        <div className="cards">{workCards.map((p) => <Card key={p.title} p={p} />)}</div>
        <Minis items={workMinis} />
      </div></section>

      <section id="music"><div className="wrap">
        <div className="kicker">Music</div>
        <h2>Music</h2>
        <p className="sub">Most of what I've built started with wanting something for my own music.</p>
        <div className="cards">{musicCards.map((p) => <Card key={p.title} p={p} />)}</div>
        <Minis items={musicMinis} />
      </div></section>

      <section id="games"><div className="wrap">
        <div className="kicker">Games &amp; game dev</div>
        <h2>Games and game dev</h2>
        <p className="sub">These two you can play with right now.</p>
        <GameTV />
        <div className="cards">{gameCards.map((p) => <Card key={p.title} p={p} />)}</div>
        <p className="sub" style={{ marginTop: '1.6rem' }}>Not shown here yet, and still in progress: a 3D graybox runner, a music-venue scene, and Nintendo 64 homebrew demos built with my own asset pipeline.</p>
        <Minis items={gameMinis} />
      </div></section>

      <section><div className="wrap">
        <div className="kicker">Server Story</div>
        <h2>How wanting my own Spotify turned into all of this</h2>
        <div className="teaser">
          <blockquote>
            I set up Navidrome to replace Spotify, then missed playlists and lyrics, so
            I built those. The mood playlists needed AI covers on another machine's GPU,
            so I built a job queue. Then voices went on the queue, then video, then 3D
            meshes, then a coding agent, until it all collapsed into{' '}
            <strong>one lease engine on an event-sourced Postgres log</strong>.
          </blockquote>
          <Link className="btn primary" to="/story">Read the full story</Link>
        </div>
      </div></section>
    </>
  )
}
