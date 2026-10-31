import { useEffect } from 'react'

export function Bio() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <main className="wrap">
      <article className="essay">
        <h1>How I got here</h1>

        <p>
          My name is Hector Jacquez, and games are the reason I do any of this. They are what
          first made me curious about how technology actually works, and that curiosity slowly
          turned into a love of programming that eventually became my career. Along the way games
          also introduced me to the other things I care about most, music and art, and they have
          been a steady source of joy for as long as I can remember.
        </p>

        <p>
          These days I work as a fullstack software engineer. I spent the last 4 years at ISI
          writing Java and Sencha ExtJS, and 3 years before that at CSI in C# and .NET, mostly
          on banking software. Both roles had me working across the backend and the frontend,
          building services and then putting them to use in the interface, and spending a lot of
          time in SQL making sure data was flowing the way it should. I have gotten up to speed on
          3 different legacy codebases, and I have been told more than once that I pick up
          unfamiliar systems faster than most.
        </p>

        <p>
          I have worked remotely for 4 years, collaborating with several teams and product
          designers, and I have managed to make a real impact without being in the room. I like to
          think that says something about how I work: independently when I need to, but always
          staying in touch with the people I am building alongside.
        </p>

        <p>
          Outside of work is where the games come back in. I have taken part in a couple of small
          game jams in Godot, where I focused on gameplay programming along with the music and
          sound. I also modify Game Boy games as a side hobby. It started with repairing old
          handhelds, and the next thing I knew I was reading through the Pokemon Crystal source
          code. I have spent some time with Unreal and Unity as well, though I do not have anything
          finished there yet, and I have picked up basic Photoshop and a few music production tools
          along the way. I pick up new software quickly, and that is a part of the work I really
          enjoy. Most of what lives on this site came out of that same impulse, building things
          around music, art, and games.
        </p>

        <p>
          Working in and around games has always been the dream, and even if it took me a while to
          admit that to myself, it is the direction I keep gravitating toward. I am at my happiest
          when the things I love and the work I do start to overlap.
        </p>
      </article>
    </main>
  )
}
