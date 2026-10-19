import { useEffect } from 'react'
import html from '../content/listening.html?raw'

/** The listening-stats page, ported from the static site: KPI cards and hand-
 *  built SVG charts of my play history. Trusted HTML (my own), rendered into
 *  the persistent shell. */
export function Listening() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return <main className="wrap" dangerouslySetInnerHTML={{ __html: html }} />
}
