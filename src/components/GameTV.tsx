import { useEffect, useRef, useState } from 'react'

/** The TV widget on the Games section: pressing power boots my cats' RPG live
 *  in the screen as an iframe, and pressing it again powers it back off. */
export function GameTV() {
  const [on, setOn] = useState(false)
  const [booting, setBooting] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function powerOn() {
    setOn(true)
    setBooting(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBooting(false), 600)
  }

  const toggle = () => (on ? setOn(false) : powerOn())

  return (
    <div className="tvwrap" style={{ maxWidth: 520, margin: '0.6rem auto 2.2rem' }}>
      <div className={`tv${on ? ' on' : ''}${booting ? ' boot' : ''}`}>
        <div className="tv-screen">
          {on ? (
            <iframe
              src={`${import.meta.env.BASE_URL}play/cat-rpg/index.html`}
              title="Nico's Bizarre Adventure"
              allow="autoplay; gamepad; fullscreen"
            />
          ) : (
            <div className="tv-off" onClick={powerOn}>
              <span className="tv-title">NICO'S<br />BIZARRE ADVENTURE</span>
              <span className="tv-hint">⏻ press power</span>
            </div>
          )}
        </div>
        <div className="tv-panel">
          <button className="tv-power" aria-label="Power the game on or off" onClick={toggle}>⏻</button>
          <span className="tv-led"></span>
          <span className="tv-brand">Hedgevision</span>
        </div>
      </div>
      <div className="tv-caption">my cats' RPG, running live in the TV (<a href={`${import.meta.env.BASE_URL}play/cat-rpg.html`}>fullscreen + manual</a>)</div>
    </div>
  )
}
