export type CardLink = { text: string; href: string } | { soon: string }
export interface Project { tag: string; title: string; body: string; pills: string[]; links: CardLink[] }
export interface Mini { title: string; note: string; link?: string }

export const musicCards: Project[] = [
  { tag: 'ML · audio', title: 'AutoCharter',
    body: "Turns songs into playable Clone Hero drum charts. Onset models and ride/crash classifiers I trained on my own corpus do the detection. I play every chart myself to check if it feels right under the sticks.",
    pills: ['Python', 'PyTorch', 'onset CNNs', 'Clone Hero'], links: [{ soon: 'demo video soon' }, { soon: 'write-up soon' }] },
  { tag: 'DSP · realtime', title: 'Living-Room Karaoke',
    body: "Demucs strips the vocals while a note lane scrolls on screen. YIN pitch scoring grades whatever octave you sing in and compensates for USB mic delay so the score matches what you actually hear.",
    pills: ['DSP', 'YIN', 'Demucs', 'browser audio'], links: [{ soon: 'demo video soon' }] },
  { tag: 'graphics · ports', title: 'One Visualizer, Three Hosts',
    body: "I added multi-visualizer support to my desktop player, then carried it into my Android client, a Godot toolkit, and a browser preset editor. The engine (butterchurn, the open-source Milkdrop) isn't mine.",
    pills: ['WebGL', 'butterchurn', 'Godot', 'Android'], links: [{ soon: 'preset lab video soon' }] },
  { tag: 'plugin · Go/WASM', title: '48 Moods',
    body: "A Navidrome plugin that keeps 48 mood playlists fresh. The ML half analyzes every track in my library and the plugin itself runs as WASM inside a 30-second budget. A chat layer on top lets you ask for a playlist by mood or ask trivia grounded in real sources.",
    pills: ['Go', 'WASM', 'Essentia', 'FastAPI'], links: [{ soon: 'repo soon' }] },
]
export const musicMinis: Mini[] = [
  { title: 'Feishin fork', note: 'a desktop music client I forked, with my playlist folders, looping video art behind albums, and visualizer overlays', link: 'https://github.com/HectorJacquez/feishin/tree/hedgy' },
  { title: 'Tempo fork', note: 'an Android music client I forked, with my playlists, the Hedgy chat built in, lyrics modes, and a lot of stability fixes', link: 'https://github.com/HectorJacquez/tempo/tree/hedgy' },
  { title: 'Lyrics pipeline', note: 'LRCLIB first, then whisper on separated stems for the rest, plus romaji and translation for the Japanese half' },
]
export const workMinis: Mini[] = [
  { title: 'Feishin fork', note: 'a desktop music client I forked, with my playlist folders, looping video art behind albums, and visualizer overlays', link: 'https://github.com/HectorJacquez/feishin/tree/hedgy' },
  { title: 'Tempo fork', note: 'an Android music client I forked, with my playlists, the Hedgy chat built in, lyrics modes, and a lot of stability fixes', link: 'https://github.com/HectorJacquez/tempo/tree/hedgy' },
]
export const workCards: Project[] = [
  { tag: 'distributed systems', title: 'pullqueue',
    body: "The job queue behind my server's GPU work: stem separation, cover art, voice, and 3D meshes. Workers poll for jobs. A lease expires when one dies so the job re-serves, and completion is arbitrated so it only runs once. Packaged as a standalone library with crash-recovery tests in CI.",
    pills: ['Python', 'Postgres', 'event sourcing', 'CI'], links: [{ soon: 'repo soon' }] },
  { tag: 'ML infrastructure', title: 'gpustack',
    body: "Arbitration layer that keeps stem separation, local LLMs, and a coding agent from fighting over one 12 GB GPU. It coordinates through a file lock, breaks it if the holder dies, and gates on memory pressure rather than hoping two models fit.",
    pills: ['Python', 'GPU', 'file locking', 'ML infra'], links: [{ soon: 'repo soon' }] },
  { tag: 'AI engineering', title: 'The Agent Workshop',
    body: "co-hog is a coding agent that runs on my own GPU so not every task needs paid tokens. The harness mattered more than the model: check the harness first when an agent fails. Bigger campaigns like porting 5 Minecraft mods ran on frontier agents, and each new failure mode became a reusable diagnostic skill.",
    pills: ['llama.cpp', 'agent harness', 'diagnostic skills'], links: [{ soon: 'write-up soon' }] },
  { tag: 'tools · browser', title: 'Pocket Trace Recorder',
    body: "A GBA emulator that runs in your browser and records gameplay as replay files for a decompilation project. You can add it to your phone's home screen and use it offline.",
    pills: ['browser app', 'gbajs2', 'service worker'], links: [{ soon: 'live demo soon' }] },
]
export const gameCards: Project[] = [
  { tag: 'game · playable demo', title: "Nico's Bizarre Adventure",
    body: "An early demo of a Mario & Luigi style RPG starring my two cats. Built in Godot with timed action commands, a small overworld, and a boss at the end. Runs right here in the browser and works with a controller.",
    pills: ['Godot 4', 'GDScript', 'web export'], links: [{ text: 'Play the demo', href: '/play/cat-rpg.html' }] },
  { tag: 'tools · 3D', title: 'Paint on a Model',
    body: "Draw straight onto a 3D model in the browser. Nothing uploads and nothing is saved; refresh to start over.",
    pills: ['three.js', 'WebGL', 'UV painting'], links: [{ text: 'Open the painter', href: '#/paint' }] },
]
export const gameMinis: Mini[] = [
  { title: 'Godot dev tools', note: 'a reusable Godot addon with dev panels, a music analyzer, a fractal sky, and a visualizer kit' },
  { title: 'Fabric port fleet', note: '5 Minecraft mods ported to 1.21.1 through an agent campaign, with a skill library behind it' },
]
