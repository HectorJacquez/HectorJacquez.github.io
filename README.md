# hectorjacquez.github.io

The source for my personal site, live at https://hectorjacquez.github.io. It collects the music, game and systems work I do in my own time, with longer write-ups and a couple of things you can play with in the browser.

**It is a work in progress.** I built it by hand as plain HTML, CSS and JavaScript while I kept adding to it, and I am still changing things, so if you are reading the code here rather than looking at the site, expect some rough edges and a few pieces mid-move. I plan to rebuild it on a component framework once the content settles.

## Running it

Static site, no build step, no dependencies. Open `index.html` or serve the folder:

```bash
python -m http.server 8777 --directory .
```

## Layout

| path | what |
|---|---|
| `index.html` | landing: hero, featured cards, live-demos strip, shelf |
| `essay.html` | the origin story, with the animated pipeline diorama |
| `stats.html` | "Twelve years of listening" — baked charts, no live data calls |
| `diorama.html` | the diorama as a standalone fragment (also inlined in the essay) |
| `play/cat-rpg.html` | wrapper page for the game: embed + controls manual |
| `play/cat-rpg/` | the Godot web export (gitignored in the working tree, added at deploy) |
| `play/paint/` | 3D texture-paint demo, pulled out of the hub's painting engine |
| `learn/` | prototype of the interactive explainer (the full one lives on the hub) |
| `style.css` | the whole design system: tokens, nav, hero, cards |

## Conventions

- Colors come from CSS custom properties only (`--accent` amber, `--accent-2` violet, `--accent-3` teal). Light and dark are both real; never hardcode a hex in a page.
- `style.css` is linked with a `?v=` cache-buster. Bump it when the palette or layout changes, or browsers serve a stale copy for days.
- Everything respects `prefers-reduced-motion`.
- Vendored JS only, no CDNs or analytics. The one external request is Google Fonts, for the display typeface.
