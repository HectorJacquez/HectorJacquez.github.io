import { useEffect, useRef, useState } from 'react'
import { volumeFromDrag } from '../audio/volume'
import { vizBus, connectAnalyser } from '../audio/vizBus'
import { sfx } from '../sfx'

/** The corner Water player: play/pause + a drag-to-set volume knob. Lives in the
 *  shell so it persists across routes. */
export function MusicDot() {
  const audio = useRef<HTMLAudioElement>(null)
  const ctx = useRef<AudioContext | null>(null)
  const [playing, setPlaying] = useState(false)
  const [vol, setVol] = useState(0.35)

  useEffect(() => { if (audio.current) audio.current.volume = vol; sfx.setVolume(vol / 0.35) }, [vol])

  // keep the shared bus in sync so the edge visualizer swells and idles with us
  useEffect(() => { vizBus.playing = playing }, [playing])

  function toggle() {
    const el = audio.current
    if (!el) { setPlaying((p) => !p); return }
    // build the analyser graph on first play (needs a user gesture)
    if (!ctx.current) ctx.current = connectAnalyser(el)
    if (ctx.current && ctx.current.state === 'suspended') void ctx.current.resume()
    if (playing) { el.pause(); setPlaying(false) }
    else {
      const p = el.play() as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => {})
      setPlaying(true)
    }
  }

  function onKnobDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const startY = e.clientY, startVol = vol
    const move = (ev: PointerEvent) => setVol(volumeFromDrag(startVol, ev.clientY - startY))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      <div className={playing ? 'musicdot playing' : 'musicdot'} title="Water, from my own album">
        <button className="md-btn" aria-label={playing ? 'Pause' : 'Play Water, my own music'} onClick={toggle}>
          <span className="pbicon">
            {playing ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="7" y="5" width="3.6" height="14" rx="1.2" /><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.2v13.6a1 1 0 0 0 1.52.85l10.9-6.8a1 1 0 0 0 0-1.7L9.52 4.35A1 1 0 0 0 8 5.2z" />
              </svg>
            )}
          </span>
        </button>
        <div className="knob" role="slider" tabIndex={0} aria-label="Volume"
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vol * 100)}
             title="Volume (drag up or down)" onPointerDown={onKnobDown}>
          <span className="knob-ind" style={{ transform: `rotate(${vol * 270 - 135}deg)` }} />
        </div>
      </div>
      <audio ref={audio} data-testid="music-player" src={`${import.meta.env.BASE_URL}media/water.mp3`}
             preload="none" onEnded={() => setPlaying(false)} />
    </>
  )
}
