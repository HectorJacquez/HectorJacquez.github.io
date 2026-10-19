// Not wired yet (TDD red step): the button doesn't toggle.
export function MusicDot() {
  return (
    <>
      <div className="musicdot" title="Water, from my own album">
        <button className="md-btn" aria-label="Play Water, my own music"><span className="pbicon">▶</span></button>
      </div>
      <audio data-testid="music-player" />
    </>
  )
}
