import { monthly, MONTHS } from '../data/listening'

/** Plays per month, 2014 on, as a heatmap. Cell brightness is the month's total
 *  plays against the busiest month; cell hue marks the source: the Spotify
 *  archive (accent) through mid-2026, then the live self-hosted server (accent-2)
 *  once I moved my day-to-day listening onto Navidrome. */
export function MonthlyHeatmap() {
  const colW = 56
  const x0 = 63
  const rowH = 28
  const y0 = 26
  const max = Math.max(1, ...monthly.flatMap((r) => MONTHS.map((_, c) => r.spotify[c] + r.navidrome[c])))
  const h = y0 + monthly.length * rowH + 6
  return (
    <svg viewBox={`0 0 744 ${h}`} role="img" aria-label="Plays per month, Spotify archive then self-hosted">
      {MONTHS.map((m, i) => (
        <text key={m} x={x0 + i * colW + colW / 2} y={16} textAnchor="middle" className="ax">{m}</text>
      ))}
      {monthly.map((row, r) => {
        const y = y0 + r * rowH
        return (
          <g key={row.year}>
            <text x={x0 - 12} y={y + rowH / 2 + 4} textAnchor="end" className="ax">{row.year}</text>
            {MONTHS.map((_, c) => {
              const x = x0 + c * colW
              const sp = row.spotify[c]
              const nv = row.navidrome[c]
              const v = sp + nv
              const pct = Math.round((v / max) * 85)
              const selfHosted = nv > sp
              const hue = selfHosted ? 'var(--accent-2)' : 'var(--accent)'
              return (
                <rect key={c} x={x + 2} y={y + 2} width={colW - 5} height={rowH - 5} rx={2}
                      className={v === 0 ? 'zero' : undefined}
                      style={v === 0 ? undefined : { fill: `color-mix(in srgb, ${hue} ${pct}%, var(--bg-raise))` }}>
                  <title>{`${MONTHS[c]} ${row.year} — ${v.toLocaleString()} plays${v ? ` (${selfHosted ? 'self-hosted' : 'Spotify'})` : ''}`}</title>
                </rect>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
