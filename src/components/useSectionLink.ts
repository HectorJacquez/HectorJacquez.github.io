import { useCallback } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/** Click handler for in-page section links under HashRouter. A plain href="#id"
 *  anchor would overwrite the router's hash and blank the page, so instead: go
 *  to the home route if we're elsewhere, then smooth-scroll to the section.
 *  `after` runs once handled (e.g. to close the mobile menu). */
export function useSectionLink() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (id: string, after?: () => void) => (e: MouseEvent) => {
      e.preventDefault()
      const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
      if (location.pathname !== '/') {
        navigate('/')
        // let Home mount before scrolling to its section
        requestAnimationFrame(() => requestAnimationFrame(scroll))
      } else {
        scroll()
      }
      after?.()
    },
    [navigate, location.pathname],
  )
}
