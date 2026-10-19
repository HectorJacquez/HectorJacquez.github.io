import { useEffect, useRef } from 'react'
import { vizBus } from '../audio/vizBus'
import { splitSpectrum } from '../audio/splitSpectrum'
import { autoGain } from '../audio/autoGain'
import { distributeDrive } from '../audio/distribute'
import { envelopeFollower } from '../audio/envelope'
import { waveFrac, clampX } from '../audio/waveform'

/** Horizontal visualizer for narrow screens, shown above the hero title. Always
 *  travels on its own (idle shimmer); the Water track swells it. Mirrors the
 *  desktop edge lines, which are hidden on mobile. */
export function TopWave() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = ref.current
    const cx = el?.getContext('2d')
    if (!el || !cx) return // no 2d context (e.g. jsdom)

    const fit = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      el.width = el.offsetWidth * dpr
      el.height = el.offsetHeight * dpr
    }
    fit()
    addEventListener('resize', fit)

    let peak = 0.08
    let driveLow = 0
    let driveHigh = 0
    const ATTACK = 0.2
    const RELEASE = 0.06
    const HIGH_BOOST = 2
    let raf = 0

    const draw = (t: number) => {
      const styles = getComputedStyle(document.documentElement)
      const c1 = styles.getPropertyValue('--accent').trim()
      const c2 = styles.getPropertyValue('--accent-2').trim()
      const playing = vizBus.playing && !!vizBus.analyser && !!vizBus.data
      if (playing) vizBus.analyser!.getByteFrequencyData(vizBus.data!)

      let targetLow = 0
      let targetHigh = 0
      if (playing) {
        const raw = splitSpectrum(vizBus.data!)
        const ag = autoGain(raw.low + raw.high, peak)
        peak = ag.peak
        const d = distributeDrive(raw.low, raw.high, ag.gain, HIGH_BOOST)
        targetLow = d.low
        targetHigh = d.high
      }
      driveLow = envelopeFollower(driveLow, targetLow, ATTACK, RELEASE)
      driveHigh = envelopeFollower(driveHigh, targetHigh, ATTACK, RELEASE)

      const w = el.width
      const h = el.height
      cx.clearRect(0, 0, w, h)
      if (w === 0 || h === 0) return
      const mid = h / 2
      const n = playing ? vizBus.data!.length : 0
      const b1 = Math.max(4, Math.round(n * 0.1))
      const b2 = Math.max(b1 + 4, Math.round(n * 0.42))

      // low band drives c1, high band c2; different wave freqs so they weave
      const lines: [string, number, number, number, number, number, number, number][] = [
        [c1, 0.0, 0.0016, 9, 0, b1, driveLow, 1.0],
        [c2, 2.3, 0.0012, 15, b1, b2, driveHigh, 1.5],
      ]
      lines.forEach(([col, phase, spd, freq, bLo, bHi, drive, boost], i) => {
        cx.beginPath()
        for (let x = 0; x <= w; x += 4) {
          const u = x / w
          const wob =
            Math.sin(u * freq + t * spd + phase) +
            0.5 * Math.sin(u * (freq * 2.4) - t * 0.0009) +
            0.3 * Math.sin(u * (freq * 4.8) + t * 0.002)
          let mag = 0
          if (playing && drive > 0.002) {
            const band = Math.min(n - 1, bLo + ((Math.pow(u, 1.25) * (bHi - bLo)) | 0))
            mag = (vizBus.data![band] / 255) * (0.55 + 1.1 * u) * drive
          }
          const frac = waveFrac(wob, { live: true, energy: drive, mag, boost })
          const y = clampX(mid, 1, frac, h) // reuse the border clamp on the vertical axis
          x === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y)
        }
        const d = Math.min(1, drive)
        cx.strokeStyle = col
        cx.globalAlpha = 0.5 + d * 0.2 - i * 0.15
        cx.lineWidth = 1.4 + d * 0.5
        cx.shadowColor = col
        cx.shadowBlur = 8 + d * 5
        cx.stroke()
        cx.shadowBlur = 0
      })
      cx.globalAlpha = 1
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', fit)
    }
  }, [])

  return <canvas ref={ref} className="topwave" aria-hidden="true" />
}
