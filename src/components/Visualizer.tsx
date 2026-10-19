import { useEffect, useRef } from 'react'
import { vizBus } from '../audio/vizBus'
import { splitSpectrum } from '../audio/splitSpectrum'
import { autoGain } from '../audio/autoGain'
import { waveFrac, clampX } from '../audio/waveform'

/** Two vertical waveforms pinned to the page edges (desktop only). They idle
 *  with a quiet shimmer and swell with the Water track while it plays. Lives in
 *  the shell so it persists across routes alongside the player. */
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

    // decaying peaks for auto-gain, one per band (see autoGain)
    let peakLow = 0.08
    let peakHigh = 0.08
    let raf = 0

    const draw = (t: number) => {
      const styles = getComputedStyle(document.documentElement)
      const c1 = styles.getPropertyValue('--accent').trim()
      const c2 = styles.getPropertyValue('--accent-2').trim()
      const live = vizBus.playing && !!vizBus.analyser && !!vizBus.data
      if (live) vizBus.analyser!.getByteFrequencyData(vizBus.data!)

      // one split + auto-gain per frame, shared by both mirrored panes
      const bands = live ? splitSpectrum(vizBus.data!) : { low: 0, high: 0 }
      if (live) {
        const gl = autoGain(bands.low, peakLow)
        const gh = autoGain(bands.high, peakHigh)
        peakLow = gl.peak
        peakHigh = gh.peak
        bands.low = gl.gain
        bands.high = gh.gain
      }

      panes.forEach((p) => {
        const w = p.el.width
        const h = p.el.height
        const cx = p.cx
        cx.clearRect(0, 0, w, h)
        if (w === 0 || h === 0) return // hidden (mobile): nothing to draw
        const base = p.dir > 0 ? w * 0.3 : w * 0.7
        const n = live ? vizBus.data!.length : 0
        const b1 = Math.max(4, Math.round(n * 0.1))
        const b2 = Math.max(b1 + 4, Math.round(n * 0.42))

        // c1 driven by the LOW band, c2 by the HIGH band; different wave
        // frequencies so the colors weave apart instead of tracking together.
        const lines: [string, number, number, number, number, number, number, number][] = [
          [c1, 0.0, 0.0016, 9, 0, b1, bands.low, 1.0],
          [c2, 2.3, 0.0012, 15, b1, b2, bands.high, 1.5],
        ]
        lines.forEach(([col, phase, spd, freq, bLo, bHi, en, boost], i) => {
          cx.beginPath()
          for (let y = 0; y <= h; y += 4) {
            const u = y / h
            const wob =
              Math.sin(u * freq + t * spd + phase) +
              0.5 * Math.sin(u * (freq * 2.4) - t * 0.0009) +
              0.3 * Math.sin(u * (freq * 4.8) + t * 0.002)
            let mag = 0
            if (live) {
              const band = Math.min(n - 1, bLo + ((Math.pow(u, 1.25) * (bHi - bLo)) | 0))
              mag = (vizBus.data![band] / 255) * (0.55 + 1.1 * u)
            }
            const frac = waveFrac(wob, { live, energy: en, mag, boost })
            const x = clampX(base, p.dir, frac, w)
            y === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y)
          }
          cx.strokeStyle = col
          cx.globalAlpha = live ? 0.7 - i * 0.15 : 0.5 - i * 0.18
          cx.lineWidth = live ? 1.8 : 1.4
          cx.shadowColor = col
          cx.shadowBlur = live ? 12 : 8
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
