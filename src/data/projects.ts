export type CardLink = { text: string; href: string } | { soon: string }
export interface Project { title: string; body: string; pills: string[]; links: CardLink[] }
export interface Mini { title: string; note: string; link?: string }

// GitHub-linked chips go first in each list: they are the ones a reader can open.
export const workMinis: Mini[] = [
  { title: 'Listening (Angular)', note: 'a demo over my music server\'s listening history, with artist bios, facts and previews pulled live from Wikipedia, MusicBrainz and iTunes', link: 'https://github.com/HectorJacquez/listening-angular' },
  { title: 'Feishin fork', note: 'a desktop music client I forked, with my playlist folders, looping video art behind albums, and visualizer overlays', link: 'https://github.com/HectorJacquez/feishin/tree/hedgy' },
  { title: 'Tempo fork', note: 'an Android music client I forked, with my playlists, the Hedgy chat built in, lyrics modes, and a lot of stability fixes', link: 'https://github.com/HectorJacquez/tempo/tree/hedgy' },
  { title: 'pullqueue', note: 'the job queue behind my server\'s GPU work. Workers poll for jobs, a lease expires when one dies so the job re-serves, and completion only runs once' },
  { title: 'gpustack', note: 'keeps stem separation, local LLMs, and a coding agent from fighting over one 12 GB GPU, with a file lock and a memory pressure gate' },
  { title: 'co-hog', note: 'a coding agent that runs on my own GPU so not every task needs paid tokens. The harness mattered more than the model' },
]
export const musicMinis: Mini[] = [
  { title: 'AutoCharter', note: 'turns songs into playable Clone Hero drum charts. ADTOF finds the drum hits, I built everything that turns them into a chart, and I play every chart myself to check it' },
  { title: 'Living-Room Karaoke', note: 'Demucs strips the vocals while a note lane scrolls on screen, and YIN pitch scoring grades whatever octave you sing in' },
  { title: 'One Visualizer, Three Hosts', note: 'multi-visualizer support in my desktop player, carried into my Android client, a Godot toolkit, and a browser preset editor. The engine, butterchurn, isn\'t mine' },
  { title: '48 Moods', note: 'a Navidrome plugin that keeps 48 mood playlists fresh, running as WASM inside a 30-second budget' },
  { title: 'Lyrics pipeline', note: 'LRCLIB first, then whisper on separated stems for the rest, plus romaji and translation for the Japanese half' },
]
export const gameCards: Project[] = [
  { title: "Nico's Bizarre Adventure",
    body: "An early demo of a Mario & Luigi style RPG starring my two cats. Built in Godot with timed action commands, a small overworld, and a boss at the end. Runs right here in the browser and works with a controller.",
    pills: ['Godot 4', 'GDScript', 'web export'], links: [{ text: 'Play the demo', href: '#/play' }] },
  { title: 'Paint on a Model',
    body: "Draw straight onto a 3D model in the browser. Nothing uploads and nothing is saved; refresh to start over.",
    pills: ['three.js', 'WebGL', 'UV painting'], links: [{ text: 'Open the painter', href: '#/paint' }] },
]
export const gameMinis: Mini[] = [
  { title: 'Godot dev tools', note: 'a reusable Godot addon with dev panels, a music analyzer, a fractal sky, and a visualizer kit' },
  { title: 'Fabric port fleet', note: '5 Minecraft mods ported to 1.21.1 through an agent campaign, with a skill library behind it' },
]
