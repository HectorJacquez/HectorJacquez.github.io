# Portfolio site

Static site. No build step, no dependencies — open `index.html` or serve the
folder.

```bash
python -m http.server 8777 --directory .
```

## Layout

| path | what |
|---|---|
| `index.html` | landing: hero + CRT console reveal, featured cards, live-demos strip, shelf |
| `essay.html` | the origin story, with the animated pipeline diorama |
| `stats.html` | "Twelve years of listening" — baked charts, no live data calls |
| `diorama.html` | the diorama as a standalone fragment (also inlined in the essay) |
| `play/cat-rpg.html` | wrapper page for the game: embed + controls manual |
| `play/cat-rpg/` | **generated**, gitignored — rebuild with `webplay/export-cat-rpg.sh` |
| `play/paint/` | 3D texture-paint demo on the hub's real painting engine |
| `learn/` | prototype of the interactive explainer (the real one lives on the hub) |
| `style.css` | the whole design system: tokens, nav, hero, TV, cards |

## Conventions

- **Colors come from CSS custom properties only** (`--accent` green,
  `--accent-2` violet, `--accent-3` amber). Light and dark are both real; never
  hardcode a hex in a page.
- `style.css` is linked with a `?v=` cache-buster. Bump it when the palette
  changes or browsers will serve a stale copy for days.
- Everything respects `prefers-reduced-motion`.
- No external requests: no CDNs, no fonts, no analytics. Vendored JS only.
