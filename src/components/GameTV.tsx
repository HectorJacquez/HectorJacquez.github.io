/** The TV widget on the Games section: pressing power boots my cats' RPG live
 *  in the screen as an iframe, and pressing it again powers it back off. */
export function GameTV() {
  return (
    <div className="tvwrap" style={{ maxWidth: 520, margin: '0.6rem auto 2.2rem' }}>
      <div className="tv">
        <div className="tv-screen">
          <div className="tv-off">
            <span className="tv-title">NICO'S<br />BIZARRE ADVENTURE</span>
            <span className="tv-hint">⏻ press power</span>
          </div>
        </div>
        <div className="tv-panel">
          <button className="tv-power" aria-label="Power the game on or off">⏻</button>
          <span className="tv-led"></span>
          <span className="tv-brand">Hedgevision</span>
        </div>
      </div>
      <div className="tv-caption">my cats' RPG, running live in the TV (<a href={`${import.meta.env.BASE_URL}play/cat-rpg.html`}>fullscreen + manual</a>)</div>
    </div>
  )
}
