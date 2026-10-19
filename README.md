# hectorjacquez.github.io

Portfolio site, live at https://hectorjacquez.github.io.

Vite + React + TypeScript SPA. The music player and visualizer live in a
persistent shell outside the router so they don't remount on navigation. The
visualizer splits audio into bass and treble bands and drives one edge line
with each; an envelope follower smooths the transitions so it winds up
gradually instead of snapping.

Built test-first with Vitest + React Testing Library + jsdom. CI runs the
suite on every push, and the commit history shows features going red then
green rather than only ever green.

## Pages

- **Home**: hero, work sections (Music / Engineering / Games), embedded
  cat-rpg TV, and a teaser linking to the full story.
- **The Story**: how replacing Spotify turned into a self-hosted platform.
- **Listening**: monthly heatmap, Spotify-to-Navidrome handoff chart, top
  artists, and listening clock, all regenerated from live server stats.

## Stats sync

Listening data comes from the live server, not hand-edited.

```bash
~/Documents/hedgy-hub/venv/bin/python scripts/sync-listening-stats.py          # from cache
~/Documents/hedgy-hub/venv/bin/python scripts/sync-listening-stats.py --refresh # rebuild cache first
```

## Development

```bash
npm install
npm run dev        # local dev server
npm run test       # watch mode
npm run test:run   # single pass (what CI runs)
npm run typecheck  # type check without emitting
```

## CI / CD

- **ci.yml**: typecheck, test, build on every push.
- **deploy.yml**: build and deploy to GitHub Pages on push to `main`.
