import { useEffect, useRef } from 'react'

export function GameOverlay({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="game-overlay" ref={overlayRef} onClick={(e) => {
      if (e.target === overlayRef.current) onClose()
    }}>
      <div className="game-overlay-inner">
        <button className="game-overlay-close" onClick={onClose} aria-label="Close game">✕</button>
        <div className="game-overlay-screen">
          <iframe
            src={`${import.meta.env.BASE_URL}play/cat-rpg/index.html`}
            title="Nico's Bizarre Adventure"
            allow="autoplay; gamepad; fullscreen"
          />
        </div>
        <div className="game-overlay-caption">
          Nico's Bizarre Adventure
          <a href={`${import.meta.env.BASE_URL}play/cat-rpg.html`}>fullscreen + manual</a>
        </div>
      </div>
    </div>
  )
}
