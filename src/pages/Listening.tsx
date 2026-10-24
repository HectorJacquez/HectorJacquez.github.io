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
        <div className="kicker">Data · from my own server</div>
        <h1>12 years of <em>listening</em></h1>
        <p className="dek">I left Spotify and built my own music server, which means I also
        own the data. Every chart below is baked from my self-hosted listening history
        and the audio-analysis pipeline that scores my library, no analytics service involved.</p>
      </header>

      <div className="kpis">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}><b>{k.value}</b><span>{k.label}</span></div>
        ))}
      </div>

      <Chart
        title="Every month since 2014"
        note="The play log, month by month. The quiet opening isn't silence, it's the years my desktop players kept no log; streaming history picks up in earnest in 2017, and 2018 is the loudest year on record. Orange months come from my Spotify archive; purple months are my own server, which starts logging in August 2026 when I moved my listening onto it and mostly stopped streaming. The colour flip is the migration."
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
        title="Leaving Spotify, in one chart"
        note="2026, month by month, split by where the plays came from. Spotify (orange) trails off through the summer; my own server (purple) picks up from August, when I made it my daily player and kept Spotify only for saving new songs to the wishlist. Before August my server kept no dated log, so this is the first stretch where the two are separable."
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
        title="The all-time ten"
        note="Top artists across every era and source, streaming history and local server plays merged, with the overlap deduplicated so nobody gets counted twice."
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
        title="The shape of my library"
        note={<>Every track in the library runs through my local mood-analysis pipeline (Essentia models for valence and intensity). Of {n(17245)} tracks, {n(moodQuadrants.reduce((s, q) => s + q.tracks, 0))} landed in a clear quadrant. Over half sit in the sad · calm corner, which tracks with the shoegaze and post-rock that dominate the collection; the happy · intense quadrant is the second largest, mostly J-rock and punk.</>}
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
        title="The listening clock"
        note="The 209,512 plays that carry an hour-of-day stamp, in local time. The early-afternoon peak is the work soundtrack; 19% of everything happened after dark (10pm to 4am)."
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

      <p className="provenance">From my self-hosted listening history, 2014–2026 · play counts
      merged across streaming export and my own server · mood scores from my local analysis
      pipeline (Essentia models) · the listening-time figure is partly estimated from track
      lengths, and years before 2014 were never logged, so real totals run higher, not lower.</p>
    </main>
  )
}
