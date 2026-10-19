import { useEffect } from 'react'
import html from '../content/story.html?raw'

/** The long-form essay, ported from the static site. The content is my own
 *  trusted HTML (prose plus an inline animated diagram), rendered into the
 *  persistent shell so the player and visualizer keep running. */
export function Story() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <main className="wrap" dangerouslySetInnerHTML={{ __html: html }} />
}
