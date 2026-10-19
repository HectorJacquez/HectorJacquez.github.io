import { Link } from 'react-router-dom'
import niko from '../assets/niko-nose-2.png'

/** The niko-nose pill + name, linking home. Uses the ported portfolio.css. */
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brandmark">
        <img className="brandimg" src={niko} alt="" width={54} height={28} />
      </span>
      <span className="brandname">Hector Jacquez</span>
    </Link>
  )
}
