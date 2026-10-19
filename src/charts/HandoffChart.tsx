import { scaleLinear, axisTicks } from './scale'
import { monthly, MONTHS } from '../data/listening'

/** The 2026 handoff: stacked monthly bars with the Spotify archive (accent)
 *  giving way to the live self-hosted server (accent-2). Shows the migration
 *  the whole-history heatmap can only hint at. */
export function HandoffChart() {
  const row = monthly.find((m) => m.year === 2026)
  if (!row) return null

  const x0 = 40
  const right = 846
  const baseline = 200
  const topY = 20
  const totals = MONTHS.map((_, i) => row.spotify[i] + row.navidrome[i])
  const axis = axisTicks(Math.max(1, ...totals), 3)
  const y = scaleLinear(0, axis.top, baseline, topY)
  const hOf = (v: number) => baseline - y(v)
  const slotW = (right - x0) / MONTHS.length
  const barW = slotW * 0.6

  return (
    <svg viewBox="0 0 860 240" role="img" aria-label="2026 handoff from Spotify to the self-hosted server">
      {axis.ticks.map((t) => (
        <g key={t}>
          <line x1={x0} y1={y(t)} x2={right} y2={y(t)} className="grid" />
          <text x={x0 - 6} y={y(t) + 4} textAnchor="end" className="ax">{(t / 1000).toLocaleString()}k</text>
        </g>
      ))}
      <line x1={x0} y1={baseline} x2={right} y2={baseline} className="axis" />
      {MONTHS.map((m, i) => {
        const bx = x0 + i * slotW + (slotW - barW) / 2
        const sp = row.spotify[i]
        const nv = row.navidrome[i]
        const spH = hOf(sp)
        const nvH = hOf(nv)
        const spY = baseline - spH
        const nvY = spY - nvH
        return (
          <g key={m}>
            {sp > 0 && (
              <rect x={bx} y={spY} width={barW} height={spH} fill="var(--accent)" rx={2}>
                <title>{`${m} 2026 — ${sp.toLocaleString()} on Spotify`}</title>
              </rect>
            )}
            {nv > 0 && (
              <rect x={bx} y={nvY} width={barW} height={nvH} fill="var(--accent-2)" rx={2}>
                <title>{`${m} 2026 — ${nv.toLocaleString()} on my own server`}</title>
              </rect>
            )}
            <text x={bx + barW / 2} y={220} textAnchor="middle" className="ax">{m}</text>
          </g>
        )
      })}
      <g>
        <rect x={x0} y={-2} width={11} height={11} fill="var(--accent)" rx={2} />
        <text x={x0 + 16} y={8} className="axd">Spotify</text>
        <rect x={x0 + 90} y={-2} width={11} height={11} fill="var(--accent-2)" rx={2} />
        <text x={x0 + 106} y={8} className="axd">my own server</text>
      </g>
    </svg>
  )
}
