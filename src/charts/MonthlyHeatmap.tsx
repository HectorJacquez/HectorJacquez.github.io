import { monthly, MONTHS } from '../data/listening'

/** Plays per month, 2014–2026, as a heatmap: one cell per month, shaded by how
 *  many plays it held against the busiest month on record. */
export function MonthlyHeatmap() {
  const colW = 56
  const x0 = 63
  const rowH = 28
  const y0 = 26
  const max = Math.max(...monthly.flatMap((r) => r.months))
  const h = y0 + monthly.length * rowH + 6
  return (
    <svg viewBox={`0 0 744 ${h}`} role="img" aria-label="Plays per month, 2014 to 2026">
      {MONTHS.map((m, i) => (
        <text key={m} x={x0 + i * colW + colW / 2} y={16} textAnchor="middle" className="ax">{m}</text>
      ))}
      {monthly.map((row, r) => {
        const y = y0 + r * rowH
        return (
          <g key={row.year}>
            <text x={x0 - 12} y={y + rowH / 2 + 4} textAnchor="end" className="ax">{row.year}</text>
            {row.months.map((v, c) => {
              const x = x0 + c * colW
              const pct = Math.round((v / max) * 85)
              return (
                <rect key={c} x={x + 2} y={y + 2} width={colW - 5} height={rowH - 5} rx={2}
                      className={v === 0 ? 'zero' : undefined}
                      style={v === 0 ? undefined : { fill: `color-mix(in srgb, var(--accent) ${pct}%, var(--bg-raise))` }}>
                  <title>{`${MONTHS[c]} ${row.year} — ${v.toLocaleString()} plays`}</title>
                </rect>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
