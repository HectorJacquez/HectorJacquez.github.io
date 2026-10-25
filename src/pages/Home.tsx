import { Link, useNavigate } from 'react-router-dom'
import { ShaderGradientCanvas, ShaderGradient } from 'shadergradient'
import { Card } from '../components/Card'
import { TopWave } from '../components/TopWave'
import { CRT3D } from '../components/CRT3D'
import { GameTV } from '../components/GameTV'
import { FloatingShapes } from '../components/FloatingShapes'
import { TextAnimate } from '../components/TextAnimate'
import { useSectionLink } from '../components/useSectionLink'
import { useSpringTilt } from '../components/useSpringTilt'
import { musicCards, musicMinis, workCards, workMinis, gameCards, gameMinis, type Mini } from '../data/projects'
import { sfx } from '../sfx'

function MiniCard({ m }: { m: Mini }) {
  const { ref, handlers } = useSpringTilt<HTMLDivElement>(6)
  return (
    <div className="mini" ref={ref} onMouseEnter={sfx.miniHover} {...handlers}>
      <span className="shift-border" />
      <b>{m.link ? <a href={m.link} target="_blank" rel="noopener noreferrer">{m.title}</a> : m.title}</b>
      <span>{m.note}</span>
    </div>
  )
}

function Minis({ items }: { items: Mini[] }) {
  return (
    <div className="mini-grid" style={{ marginTop: '1.1rem' }}>
      {items.map((m) => <MiniCard key={m.title} m={m} />)}
    </div>
  )
}

export function Home() {
  const toWork = useSectionLink()('experience')
  const navigate = useNavigate()
  return (
    <>
      <header className="hero">
        <div className="wrap">
          <TopWave />
          <div className="hero-grid">
            <div className="hero-text">
              <h1 className="kicker"><TextAnimate stagger={80}>Fullstack Software Engineer</TextAnimate></h1>
              <p className="lede">
                7 years of fullstack experience, mostly remote. 4 years in Java and
                Sencha ExtJS with SQL Server, 3 before that in C# and .NET on banking
                software. I use AI coding tools in my day-to-day work. In my own time I
                build around music, art, and games.
              </p>
              <p className="openwork">I'm looking for my next fullstack role, remote preferred.</p>
              <div className="cta-row">
                <a className="btn primary glow-btn" href="#experience" onMouseEnter={sfx.btnHover} onClick={(e) => { sfx.btnClick(); toWork(e) }}>See my work</a>
                <Link className="btn" to="/bio" onMouseEnter={sfx.btnHover} onClick={sfx.btnClick}>About</Link>
                <Link className="btn" to="/story" onMouseEnter={sfx.btnHover} onClick={sfx.btnClick}>Server story</Link>
                <span className="social-row">
                  <a className="btn icon-btn" href="mailto:hector.jacquez@outlook.com" aria-label="Email me" onMouseEnter={sfx.btnHover} onClick={sfx.btnClick}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </a>
                  <a className="btn icon-btn" href="https://www.linkedin.com/in/hector-jacquez-a13829141" aria-label="LinkedIn" onMouseEnter={sfx.btnHover} onClick={sfx.btnClick}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                  </a>
                  <a className="btn icon-btn" href="https://github.com/HectorJacquez" aria-label="GitHub" onMouseEnter={sfx.btnHover} onClick={sfx.btnClick}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                  </a>
                </span>
              </div>
            </div>
            <div className="crt-wrap">
              <div className="hero-gradient">
                <ShaderGradientCanvas
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                  fov={45}
                >
                  <ShaderGradient
                    type="waterPlane"
                    animate="on"
                    uTime={0}
                    uSpeed={0.2}
                    uStrength={1.0}
                    uDensity={1.2}
                    uFrequency={3.0}
                    uAmplitude={0}
                    positionX={0}
                    positionY={0}
                    positionZ={0}
                    rotationX={0}
                    rotationY={0}
                    rotationZ={0}
                    color1="#1a1520"
                    color2="#2a1f35"
                    color3="#1e1525"
                    reflection={0.05}
                    wireframe={false}
                    grain="off"
                  />
                </ShaderGradientCanvas>
              </div>
              <CRT3D onActivate={() => { sfx.crtClick(); navigate('/paint') }} />
            </div>
          </div>
        </div>
      </header>

      <section id="experience"><div className="wrap">
        <div className="kicker">Experience</div>
        <h2>Where I've worked</h2>
        <div className="jobs">
          <div className="job">
            <span className="job-dates">2022 – 2026</span>
            <div>
              <strong>ISI Software LLC</strong> <span className="job-role">Fullstack Software Engineer</span>
              <p>Java backend, Sencha ExtJS frontend, SQL Server, ETL pipelines, data warehouse. Remote.</p>
            </div>
          </div>
          <div className="job">
            <span className="job-dates">2019 – 2022</span>
            <div>
              <strong>Computer Services Inc.</strong> <span className="job-role">Software Engineer</span>
              <p>C#, .NET, SQL Server, WinForms, PowerShell, some Angular. Banking software. Remote.</p>
            </div>
          </div>
        </div>
      </div></section>

      <section id="work"><div className="wrap">
        <div className="kicker">Engineering</div>
        <h2>Systems and tools</h2>
        <p className="sub">The infrastructure behind my server, and some other tools.</p>
        <div style={{ position: 'relative' }}>
          <FloatingShapes />
          <div className="cards">{workCards.map((p) => <Card key={p.title} p={p} />)}</div>
        </div>
        <Minis items={workMinis} />
      </div></section>

      <section id="music"><div className="wrap">
        <div className="kicker">Music</div>
        <h2>Music</h2>
        <p className="sub">Most of what I've built started with wanting something for my own music or for experimenting with game dev tools.</p>
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
            I built those. I wanted AI covers for the mood playlists, but my strong GPU
            was on another machine, so I built a job queue.
            Then voices went on the queue, then video, then 3D
            meshes, then a coding agent, until it all collapsed into{' '}
            <strong>one lease engine on an event-sourced Postgres log</strong>.
          </blockquote>
          <Link className="btn primary" to="/story">Read the full story</Link>
        </div>
      </div></section>
    </>
  )
}
