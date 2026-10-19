import { useEffect, useRef, useState } from 'react'
import { volumeFromDrag } from '../audio/volume'

/** The corner Water player: play/pause + a drag-to-set volume knob. Lives in the
 *  shell so it persists across routes. */
export function MusicDot() {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [vol, setVol] = useState(0.35)

  useEffect(() => { if (audio.current) audio.current.volume = vol }, [vol])

  function toggle() {
    const el = audio.current
    if (!el) { setPlaying((p) => !p); return }
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
      <div className="musicdot" title="Water, from my own album">
        <button className="md-btn" aria-label={playing ? 'Pause' : 'Play Water, my own music'} onClick={toggle}>
          <span className="pbicon">{playing ? '❚❚' : '▶'}</span>
        </button>
        <div className="knob" role="slider" tabIndex={0} aria-label="Volume"
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vol * 100)}
             title="Volume (drag up or down)" onPointerDown={onKnobDown}>
          <span className="knob-ind" style={{ transform: `rotate(${vol * 270 - 135}deg)` }} />
        </div>
      </div>
      <audio ref={audio} data-testid="music-player" src={`${import.meta.env.BASE_URL}media/water.mp3`} preload="none" />
    </>
  )
}
