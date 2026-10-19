import { scaleLinear, axisTicks } from './scale'
import { hourly } from '../data/listening'

/** Plays by hour of day, as vertical bars with a nice y-axis. */
export function ListeningClock() {
  const x0 = 58
  const right = 846
  const baseline = 210
  const topY = 20
  const max = Math.max(...hourly.map((h) => h.plays))
  const axis = axisTicks(max, 3)
  const y = scaleLinear(0, axis.top, baseline, topY)
  const slotW = (right - x0) / hourly.length
  const barW = slotW * 0.66
  return (
    <svg viewBox="0 0 860 240" role="img" aria-label="Plays by hour of day">
      {axis.ticks.map((t) => (
        <g key={t}>
          <line x1={x0} y1={y(t)} x2={right} y2={y(t)} className="grid" />
          <text x={x0 - 8} y={y(t) + 4} textAnchor="end" className="ax">{t / 1000}k</text>
        </g>
      ))}
      <line x1={x0} y1={baseline} x2={right} y2={baseline} className="axis" />
      {hourly.map((d, i) => {
        const bx = x0 + i * slotW + (slotW - barW) / 2
        const bh = baseline - y(d.plays)
        return (
          <g key={d.hour}>
            <rect x={bx} y={y(d.plays)} width={barW} height={bh} rx={4} fill="var(--accent)">
              <title>{`${d.hour} — ${d.plays.toLocaleString()} plays`}</title>
            </rect>
            {i % 2 === 0 && (
              <text x={bx + barW / 2} y={230} textAnchor="middle" className="ax">{d.hour}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
