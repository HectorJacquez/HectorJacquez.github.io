import { useEffect, useRef } from 'react'
import { vizBus } from '../audio/vizBus'
import { splitSpectrum } from '../audio/splitSpectrum'
import { autoGain } from '../audio/autoGain'
import { distributeDrive } from '../audio/distribute'
import { envelopeFollower } from '../audio/envelope'
import { waveFrac, clampX } from '../audio/waveform'

/** Two vertical waveforms pinned to the page edges (desktop only). They idle
 *  with a gentle shimmer and swell with the Water track while it plays, winding
 *  up and down smoothly via an envelope follower. Lives in the shell so it
 *  persists across routes alongside the player. */
export function Visualizer() {
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rightRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const panes = [
      { el: leftRef.current, dir: 1 },
      { el: rightRef.current, dir: -1 },
    ]
      .filter((p): p is { el: HTMLCanvasElement; dir: number } => !!p.el)
      .map((p) => ({ el: p.el, dir: p.dir, cx: p.el.getContext('2d') }))
      .filter((p): p is { el: HTMLCanvasElement; dir: number; cx: CanvasRenderingContext2D } => !!p.cx)
    if (!panes.length) return // no 2d context (e.g. jsdom): nothing to draw

    const fit = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      panes.forEach((p) => {
        p.el.width = p.el.offsetWidth * dpr
        p.el.height = p.el.offsetHeight * dpr
      })
    }
    fit()
    addEventListener('resize', fit)

    // one shared auto-gain peak (so the bands keep their relative balance), the
    // drive split between the lines by spectral content, then envelope-followed.
    let peak = 0.08
    let driveLow = 0
    let driveHigh = 0
    const ATTACK = 0.2 // fast enough to show beats/transients
    const RELEASE = 0.06 // but ease back down smoothly
    const HIGH_BOOST = 2 // treble carries less raw energy than bass
    let raf = 0

    const draw = (t: number) => {
      const styles = getComputedStyle(document.documentElement)
      const c1 = styles.getPropertyValue('--accent').trim()
      const c2 = styles.getPropertyValue('--accent-2').trim()
      const playing = vizBus.playing && !!vizBus.analyser && !!vizBus.data
      if (playing) vizBus.analyser!.getByteFrequencyData(vizBus.data!)

      // overall level normalized once, then split between the lines by spectral
      // balance so bass drives one line and treble the other (not both tracking
      // volume). Zero when stopped; the envelope eases the drive toward target.
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

      panes.forEach((p) => {
        const w = p.el.width
        const h = p.el.height
        const cx = p.cx
        cx.clearRect(0, 0, w, h)
        if (w === 0 || h === 0) return // hidden (mobile): nothing to draw
        const base = p.dir > 0 ? w * 0.3 : w * 0.7
        const n = playing ? vizBus.data!.length : 0
        const b1 = Math.max(4, Math.round(n * 0.1))
        const b2 = Math.max(b1 + 4, Math.round(n * 0.42))

        // c1 driven by the LOW band, c2 by the HIGH band; different wave
        // frequencies so the colors weave apart instead of tracking together.
        const lines: [string, number, number, number, number, number, number, number][] = [
          [c1, 0.0, 0.0016, 9, 0, b1, driveLow, 1.0],
          [c2, 2.3, 0.0012, 15, b1, b2, driveHigh, 1.5],
        ]
        lines.forEach(([col, phase, spd, freq, bLo, bHi, drive, boost], i) => {
          cx.beginPath()
          for (let y = 0; y <= h; y += 4) {
            const u = y / h
            const wob =
              Math.sin(u * freq + t * spd + phase) +
              0.5 * Math.sin(u * (freq * 2.4) - t * 0.0009) +
              0.3 * Math.sin(u * (freq * 4.8) + t * 0.002)
            let mag = 0
            if (playing && drive > 0.002) {
              const band = Math.min(n - 1, bLo + ((Math.pow(u, 1.25) * (bHi - bLo)) | 0))
              mag = (vizBus.data![band] / 255) * (0.55 + 1.1 * u) * drive // detail fades in with drive
            }
            const frac = waveFrac(wob, { live: true, energy: drive, mag, boost })
            const x = clampX(base, p.dir, frac, w)
            y === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y)
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
      })
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', fit)
    }
  }, [])

  return (
    <>
      <canvas ref={leftRef} className="sidewave l" aria-hidden="true" />
      <canvas ref={rightRef} className="sidewave r" aria-hidden="true" />
    </>
  )
}
