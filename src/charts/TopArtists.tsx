import { scaleLinear } from './scale'
import { topArtists } from '../data/listening'

/** All-time top ten, as a horizontal bar chart. Bar length is the play count
 *  scaled against the busiest artist. */
export function TopArtists() {
  const x0 = 238
  const barMax = 532
  const rowH = 32
  const max = Math.max(...topArtists.map((a) => a.plays))
  const width = scaleLinear(0, max, 0, barMax)
  const h = topArtists.length * rowH + 6
  return (
    <svg viewBox={`0 0 860 ${h}`} role="img" aria-label="All-time top ten artists">
      <line x1={x0} y1={0} x2={x0} y2={h - 6} className="axis" />
      {topArtists.map((a, i) => {
        const y = i * rowH
        const w = width(a.plays)
        return (
          <g key={a.name}>
            <text x={x0 - 12} y={y + 18} textAnchor="end" className="lbl">{a.name}</text>
            <rect x={x0} y={y + 4} width={w} height={18} rx={4} fill="var(--accent)">
              <title>{`${a.name} — ${a.plays.toLocaleString()} plays`}</title>
            </rect>
            <text x={x0 + w + 10} y={y + 18} className="axd">{a.plays.toLocaleString()}</text>
          </g>
        )
      })}
    </svg>
  )
}
