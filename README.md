# portfolio-react

The React rebuild of my portfolio site (the live static version is at
https://hectorjacquez.github.io while this is in progress).

Vite + React + TypeScript, with a persistent shell so the music and visualizer
survive page navigation. Built **test-first**: Vitest + React Testing Library,
and CI runs the suite on every push and pull request, so the test history shows
features going red then green rather than only ever green.

```bash
npm install
npm run dev        # local dev server
npm run test       # watch mode (red-green loop)
npm run test:run   # single pass (what CI runs)
```

Work in progress.
