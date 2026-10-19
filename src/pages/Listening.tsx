import { useEffect, type ReactNode } from 'react'
import { kpis, monthly, MONTHS, topArtists, hourly } from '../data/listening'
import { MonthlyHeatmap } from '../charts/MonthlyHeatmap'
import { TopArtists } from '../charts/TopArtists'
import { ListeningClock } from '../charts/ListeningClock'
// MoodQuadrants is held until the analyzer finishes the full library (see below).

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
        <h1>Twelve years of <em>listening</em></h1>
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
        note="The play log, month by month. The quiet opening isn't silence, it's the years my desktop players kept no log; streaming history picks up in earnest in 2017, and 2018 is the loudest year on record. The 2026 fade is real, not missing data: that's when I moved my day-to-day listening onto my own server and stopped using Spotify for much beyond saving new songs, so the dated record winds down as my own library took over."
        table={
          <table>
            <thead><tr><th>Year</th>{MONTHS.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {monthly.map((r) => (
                <tr key={r.year}>
                  <th>{r.year}</th>
                  {r.months.map((v, i) => <td key={i}>{n(v)}</td>)}
                  <td>{n(r.months.reduce((a, b) => a + b, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <MonthlyHeatmap />
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

      {/* The mood "shape of my library" chart is held until the analyzer finishes
          the full library: only ~5.5k of 17k tracks are scored so far (and climbing),
          so the quadrant shares aren't representative yet. MoodQuadrants + moodQuadrants
          data are kept in the repo; the sync re-enables this once coverage is complete. */}

      <Chart
        title="The listening clock"
        note="The 212,602 plays that carry an hour-of-day stamp, in local time. The early-afternoon peak is the work soundtrack; 19% of everything happened after dark (10pm to 4am)."
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
      merged across streaming export and my own server, deduplicated before summing · mood
      scores from my local analysis pipeline (Essentia models); tracks whose mood vector came
      back empty are excluded from the map · the listening-time figure is partly estimated from
      track lengths, and years before 2014 were never logged, so real totals run higher, not lower.</p>
    </main>
  )
}
