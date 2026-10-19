export type CardLink = { text: string; href: string } | { soon: string }
export interface Project { tag: string; title: string; body: string; pills: string[]; links: CardLink[] }
export interface Mini { title: string; note: string }

export const musicCards: Project[] = [
  { tag: 'ML · audio', title: 'AutoCharter',
    body: "Turns songs into playable Clone Hero drum charts, using onset models along with ride and crash classifiers I trained on my own corpus. The metrics help but they don't decide it, because I play every chart myself and go by whether it feels right under the sticks.",
    pills: ['Python', 'PyTorch', 'onset CNNs', 'Clone Hero'], links: [{ soon: 'demo video soon' }, { soon: 'write-up soon' }] },
  { tag: 'DSP · realtime', title: 'Living-Room Karaoke',
    body: "I wanted karaoke night without buying anything, so Demucs strips the vocals, a note lane scrolls, and YIN pitch scoring grades whatever octave you sing in. It grades against the note you actually heard rather than the one in the file, because USB mics come with enough delay that the two don't line up.",
    pills: ['DSP', 'YIN', 'Demucs', 'browser audio'], links: [{ soon: 'demo video soon' }] },
  { tag: 'graphics · ports', title: 'One Visualizer, Three Hosts',
    body: "My desktop player already shipped the butterchurn visualizer, so I added multi-visualizer support to it, then carried the visualizer into my Android client and my own Godot toolkit, and built a browser editor for studying and writing presets. The visualizer itself (butterchurn, the open-source Milkdrop engine) isn't mine.",
    pills: ['WebGL', 'butterchurn', 'Godot', 'Android'], links: [{ soon: 'preset lab video soon' }] },
  { tag: 'plugin · Go/WASM', title: '48 Moods',
    body: "A Navidrome plugin that keeps 48 mood playlists fresh, where the ML half listens to every track in my library and the plugin half runs as WASM inside a 30-second execution budget. On top of that there is a chat harness, so you can ask for a playlist by mood and it builds one, or ask it music trivia and it answers from real sources instead of from whatever the model would make up.",
    pills: ['Go', 'WASM', 'Essentia', 'FastAPI'], links: [{ soon: 'repo soon' }] },
]
export const musicMinis: Mini[] = [
  { title: 'Feishin fork', note: 'a desktop music client I forked, with my playlist folders, looping video art behind albums, and visualizer overlays' },
  { title: 'Tempo fork', note: 'an Android music client I forked, with my playlists, the Hedgy chat built in, lyrics modes, and a lot of stability fixes' },
  { title: 'Lyrics pipeline', note: 'LRCLIB first, then whisper on separated stems for the rest, plus romaji and translation for the Japanese half' },
]
export const workCards: Project[] = [
  { tag: 'distributed systems', title: 'pullqueue',
    body: "This is the queue that runs the GPU job lanes on my home server, the stem separation and cover art and voice and mesh jobs behind the music and 3D work above. Workers poll for jobs, a lease expires when a worker dies so the job gets served to the next one, and completion is arbitrated so it only happens once. It is packaged here as a standalone library, with a kill -9 crash-recovery demo and tests in CI. A lease-based version runs on a plain JSON file; an event-sourced version runs on Postgres when the history has to survive the process.",
    pills: ['Python', 'Postgres', 'event sourcing', 'CI'], links: [{ soon: 'repo soon' }] },
  { tag: 'ML infrastructure', title: 'gpustack',
    body: "The same 12 GB GPU that renders the album art and the 3D meshes also runs stem separation, several local LLMs, and a coding agent, and this is the arbitration layer that keeps them from fighting over memory. It coordinates through a file lock rather than a daemon, breaks the lock if the process holding it dies, and gates on memory pressure instead of hoping two models happen to fit.",
    pills: ['Python', 'GPU', 'file locking', 'ML infra'], links: [{ soon: 'repo soon' }] },
  { tag: 'AI engineering', title: 'The Agent Workshop',
    body: "After my local-model assistants proved a consumer GPU could carry real work, I built co-hog, a coding agent that runs on my own 12 GB card so not every task has to lean on paid frontier tokens. The harness around it mattered more than the model inside it, and the thing it taught me was to check the harness first when an agent fails. The bigger campaigns, like porting five Minecraft mods, I ran by directing frontier agents instead, and every new kind of failure I hit there turned into a reusable diagnostic skill.",
    pills: ['llama.cpp', 'agent harness', '12GB GPU'], links: [{ soon: 'write-up soon' }] },
  { tag: 'tools · PWA', title: 'Pocket Trace Recorder',
    body: "A GBA emulator that runs in your browser and records gameplay as replay files for a decompilation project. It installs as a PWA and works on a phone, and you bring your own ROM.",
    pills: ['PWA', 'gbajs2', 'service worker'], links: [{ soon: 'live demo soon' }] },
]
export const gameCards: Project[] = [
  { tag: 'game · playable demo', title: "Nico's Bizarre Adventure",
    body: "An early demo of a Mario & Luigi style RPG starring my two cats, built in Godot, with timed action commands, a small overworld, and a boss at the end. It runs right here in your browser and works with a controller.",
    pills: ['Godot 4', 'GDScript', 'web export'], links: [{ text: '▶ play the demo', href: '/play/cat-rpg.html' }] },
  { tag: 'tools · 3D', title: 'Paint on a Model',
    body: "The texture-painting engine out of my home server's 3D tools, pulled out to run on its own so you can draw straight onto a 3D model in the browser. Nothing uploads and nothing is saved, so you refresh to start over.",
    pills: ['three.js', 'WebGL', 'UV painting'], links: [{ text: '🖌 open the painter', href: '/play/paint/' }] },
]
export const gameMinis: Mini[] = [
  { title: 'Godot dev tools', note: 'a reusable Godot addon with dev panels, a music analyzer, a fractal sky, and a visualizer kit' },
  { title: 'Fabric port fleet', note: 'five Minecraft mods ported to 1.21.1 through an agent campaign, with a skill library behind it' },
]
