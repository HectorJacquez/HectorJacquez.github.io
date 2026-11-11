import { useEffect } from 'react'

/** Written in my own words. The earlier version was a smoothed-over paraphrase
 *  of a cover letter I wrote; this one keeps the sentences I actually use. */
export function Bio() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <main className="wrap">
      <article className="essay">
        <h1>How I got here</h1>

        <p>
          My name is Hector Jacquez. I'm a fullstack software engineer. Gaming is what drove me to
          learn about technology, and it's what got me into programming in the first place. Games
          have also introduced me to the other things I care about, music and art, and they've
          provided me joy my whole life. It's always been my dream to work in or around games, so
          I do it in my free time.
        </p>

        <p>
          I spent the last 4 years at ISI writing Java and
          Sencha ExtJS, and 3 years before that at CSI in C# and .NET, mostly on banking software.
          Both jobs had me on the backend and the frontend: I created services and then put them
          to use in the UI, and I worked in SQL a lot, verifying data was flowing correctly and
          writing utilities. I've gotten up to speed on 3 different legacy codebases, and I've been
          commended for learning systems quicker than average.
        </p>

        <p>
          I've worked remotely for 4 years with multiple teams and product designers. I was even
          hired into a position in a different state while remote, which I think shows I can work
          on my own and still be a communicative team member.
        </p>

        <p>
          Outside of work is where the games come back in. I've done two small game jams in Godot,
          where my focus was gameplay programming, music and sounds. I also modify Game Boy games,
          just as a side hobby. It started out with repairing Game Boys, and next thing I knew I
          was learning about the Pokemon Crystal source code. I've spent some time with Unreal and
          Unity too, but no finished projects there yet. Between all these hobbies I've picked up
          basic Photoshop, a bunch of game editors and music production software, and an ability
          to quickly pick up new software, which is honestly the part of this work I enjoy most.
          Almost everything on this site came out of that: wanting something for my own music, or
          wanting to see if I could build it.
        </p>

        <p>
          I'd love to integrate music, art and games into my career as a software dev someday.
          Until then, this site is where that happens.
        </p>
      </article>
    </main>
  )
}
