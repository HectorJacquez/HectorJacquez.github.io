import { useEffect } from 'react'

export function Bio() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <main className="wrap">
      <article className="essay">
        <div className="kicker">About me</div>
        <h1>How I got into coding</h1>
        <p style={{ color: 'var(--ink-dim)' }}>Content coming soon.</p>
      </article>
    </main>
  )
}
