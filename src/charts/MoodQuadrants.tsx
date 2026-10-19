import { moodQuadrants } from '../data/listening'

/** The library in mood space: a 2x2 of valence (sad↔happy) by intensity
 *  (calm↔intense), each quadrant shaded by its share of scored tracks. */
export function MoodQuadrants() {
  // grid position of each labelled quadrant: [col, row] with row 0 at the top
  const place: Record<string, [number, number]> = {
    'sad · intense': [0, 0],
    'happy · intense': [1, 0],
    'sad · calm': [0, 1],
    'happy · calm': [1, 1],
  }
  const x0 = 70
  const y0 = 20
  const cell = 170
  const max = Math.max(...moodQuadrants.map((q) => q.tracks))
  return (
    <svg viewBox="0 0 460 420" role="img" aria-label="Density of the library in mood space, valence by intensity">
      {moodQuadrants.map((q) => {
        const [c, r] = place[q.label]
        const x = x0 + c * cell
        const y = y0 + r * cell
        const pct = Math.round((q.tracks / max) * 80) + 8
        return (
          <g key={q.label}>
            <rect x={x} y={y} width={cell - 4} height={cell - 4} rx={6}
                  style={{ fill: `color-mix(in srgb, var(--accent-2) ${pct}%, var(--bg-raise))` }}>
              <title>{`${q.label} — ${q.tracks.toLocaleString()} tracks (${q.share})`}</title>
            </rect>
            <text x={x + (cell - 4) / 2} y={y + cell / 2 - 8} textAnchor="middle" className="lbl">{q.label}</text>
            <text x={x + (cell - 4) / 2} y={y + cell / 2 + 16} textAnchor="middle" className="axd">
              {q.share} · {q.tracks.toLocaleString()}
            </text>
          </g>
        )
      })}
      <text x={x0 + cell} y={y0 + 2 * cell + 24} textAnchor="middle" className="ax">← sad · · · valence · · · happy →</text>
      <text x={34} y={y0 + cell} textAnchor="middle" className="ax" transform={`rotate(-90 34 ${y0 + cell})`}>← calm · · · intensity · · · intense →</text>
    </svg>
  )
}
