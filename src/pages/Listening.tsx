import { useEffect, type ReactNode } from 'react'
import { kpis, monthly, MONTHS, topArtists, hourly, moodQuadrants } from '../data/listening'
import { MonthlyHeatmap } from '../charts/MonthlyHeatmap'
import { HandoffChart } from '../charts/HandoffChart'
import { TopArtists } from '../charts/TopArtists'
import { ListeningClock } from '../charts/ListeningClock'
import { MoodQuadrants } from '../charts/MoodQuadrants'

const n = (v: number) => v.toLocaleString()

function Chart({ title, note, children, table }: { title: string; note: ReactNode; children: ReactNode; table: ReactNode }) {
  return (
    <section className="chart">
      <h2>{title}</h2>
      <p className="note">{note}</p>
      {children}
      <details>
        <summary>View as table</summary>
        <div className="tblwrap">{table}</div>
      </details>
    </section>
  )
}

/** Listening-stats page, rebuilt as data-driven React: the charts compute their
 *  geometry from the data arrays in src/data/listening.ts via the tested scale
 *  helpers, instead of shipping pre-rendered SVG. */
export function Listening() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <main className="wrap">
      <header className="stats-head">
        <h1>12 years of <em>listening</em></h1>
        <p className="dek">I left Spotify and moved my listening onto my own music server.
        These charts come from that play history and from my own analysis of the library.</p>
      </header>

      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}><b>{k.value}</b><span>{k.label}</span></div>
        ))}
      </div>

      <Chart
        title="Plays by month"
        note="Orange is Spotify, purple is my own server. My desktop players didn't keep a log before 2017, so the early years look quiet. 2018 was my biggest year."
        table={
          <table>
            <thead><tr><th>Year</th>{MONTHS.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {monthly.map((r) => {
                const tot = MONTHS.map((_, i) => r.spotify[i] + r.navidrome[i])
                return (
                  <tr key={r.year}>
                    <th>{r.year}</th>
                    {tot.map((v, i) => <td key={i}>{n(v)}</td>)}
                    <td>{n(tot.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        }
      >
        <MonthlyHeatmap />
      </Chart>

      <Chart
        title="Spotify vs. my server in 2026"
        note="I switched to my own server in August, and now I only use Spotify to save new songs to my wishlist. My server didn't keep dated plays before then."
        table={
          <table>
            <thead><tr><th>Month</th><th>Spotify</th><th>My server</th></tr></thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const r = monthly.find((x) => x.year === 2026)
                if (!r || (r.spotify[i] === 0 && r.navidrome[i] === 0)) return null
                return <tr key={m}><td>{m} 2026</td><td>{n(r.spotify[i])}</td><td>{n(r.navidrome[i])}</td></tr>
              })}
            </tbody>
          </table>
        }
      >
        <HandoffChart />
      </Chart>

      <Chart
        title="Top 10 artists"
        note="Spotify and my server combined, with each play counted once."
        table={
          <table>
            <thead><tr><th>#</th><th>Artist</th><th>Plays</th></tr></thead>
            <tbody>
              {topArtists.map((a, i) => (
                <tr key={a.name}><th>{i + 1}</th><td>{a.name}</td><td>{n(a.plays)}</td></tr>
              ))}
            </tbody>
          </table>
        }
      >
        <TopArtists />
      </Chart>

      <Chart
        title="My library by mood"
        note={<>My analysis pipeline (Essentia models) scores every track for mood. Of {n(17245)} tracks, {n(moodQuadrants.reduce((s, q) => s + q.tracks, 0))} fit clearly into one group. Over half are sad and calm, a lot of shoegaze and post-rock. Happy and intense is next, mostly J-rock and punk.</>}
        table={
          <table>
            <thead><tr><th>Quadrant</th><th>Tracks</th><th>Share</th></tr></thead>
            <tbody>
              {moodQuadrants.map((q) => (
                <tr key={q.label}><td>{q.label}</td><td>{n(q.tracks)}</td><td>{q.share}</td></tr>
              ))}
            </tbody>
          </table>
        }
      >
        <MoodQuadrants />
      </Chart>

      <Chart
        title="Plays by time of day"
        note="209,512 plays have a time of day, in local time. 19% happened between 10pm and 4am."
        table={
          <table>
            <thead><tr><th>Hour</th><th>Plays</th></tr></thead>
            <tbody>
              {hourly.map((d) => (
                <tr key={d.hour}><td>{d.hour}</td><td>{n(d.plays)}</td></tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ListeningClock />
      </Chart>

      <p className="provenance">Data from my own server, 2014 to 2026. Listening time is partly
      estimated from track lengths, and nothing before 2014 was logged.</p>
    </main>
  )
}
