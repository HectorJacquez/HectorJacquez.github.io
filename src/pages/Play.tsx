import { useEffect } from 'react'

/** The cat RPG on its own page, inside the site's shell so the nav, fonts and
 *  icons match everywhere. The game itself is a Godot web export in public/. */
export function Play() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const base = import.meta.env.BASE_URL
  return (
    <main className="wrap gamewrap">
      <div className="kicker">Playable demo</div>
      <h1>Nico's Bizarre Adventure</h1>
      <p className="demo-note">
        An early demo of a Mario &amp; Luigi style RPG starring my two cats, Shadow and Nico, with a hub,
        a few rooms, and a boss. It's built in Godot and running right here as a web export, so click
        the game once so it picks up your keyboard.
      </p>

      <iframe className="gameframe" src={`${base}play/cat-rpg/index.html`} allow="autoplay; gamepad; fullscreen" title="Nico's Bizarre Adventure" />

      <div className="manual">
        <div className="box">
          <h3>Controls</h3>
          <table>
            <tbody>
              <tr><td className="k">Arrow keys</td><td>move</td></tr>
              <tr><td className="k">Space</td><td>jump</td></tr>
              <tr><td className="k">D</td><td>Shadow's action</td></tr>
              <tr><td className="k">S</td><td>Nico's action</td></tr>
              <tr><td className="k">E</td><td>swap leader</td></tr>
              <tr><td className="k">Q</td><td>ability (Nico's Cat-Ball)</td></tr>
              <tr><td className="k">X / Esc</td><td>cancel / menu</td></tr>
            </tbody>
          </table>
          <p>A controller works too, and the buttons map like a Switch pad.</p>
        </div>
        <div className="box">
          <h3>What to do</h3>
          <p>
            Jump-bump the fish in the hub to save. The rooms branch off the hub, and once you clear the
            enemies in them the boss arena opens. In battle it plays like Mario &amp; Luigi, where jump is
            your heavy option, swipe answers specific attacks, and your timing matters on both offense and
            defense.
          </p>
          <p style={{ marginTop: '0.6rem' }}>It's a demo, so things end after the boss and some of the edges are still rough.</p>
        </div>
      </div>
    </main>
  )
}
