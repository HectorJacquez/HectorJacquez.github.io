import { Link } from 'react-router-dom'
import niko from '../assets/niko-nose-3.png'

/** The niko-nose pill + name, linking home. Clicking it also scrolls to the top,
 *  since the link alone does nothing when you are already on the home page. */
export function Brand() {
  return (
    <Link className="brand" to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <span className="brandmark">
        <svg className="brandmark-noise" aria-hidden="true">
          <defs>
            <filter id="bm-cloud">
              <feTurbulence type="fractalNoise" baseFrequency="0.25" numOctaves="6" seed="12" />
              <feColorMatrix type="matrix" values="0.3 0 0 0 0  0 0.2 0 0 0  0 0 0.1 0 0  0 0 0 0.18 0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" rx="21" filter="url(#bm-cloud)" />
        </svg>
        <img className="brandimg" src={niko} alt="" width={54} height={28} />
      </span>
      <span className="brandname">Hector Jacquez</span>
    </Link>
  )
}
