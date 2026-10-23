const cache = new Map<string, AudioBuffer>()
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  try { ctx = new AudioContext() } catch { return null }
  return ctx
}

async function load(path: string): Promise<AudioBuffer | null> {
  const ac = getCtx()
  if (!ac) return null
  const cached = cache.get(path)
  if (cached) return cached
  try {
    const res = await fetch(path)
    const buf = await ac.decodeAudioData(await res.arrayBuffer())
    cache.set(path, buf)
    return buf
  } catch { return null }
}

// D/G major scale pitch ratios (semitones from root D4)
const DG_SCALE = [
  0.8409,  // B3  (-3)
  1.0,     // D4  (root)
  1.1225,  // E4  (+2)
  1.2599,  // F#4 (+4)
  1.3348,  // G4  (+5)
  1.4983,  // A4  (+7)
  1.6818,  // B4  (+9)
]

function play(path: string, vol = 0.5, pitched = false) {
  if (muted) return
  const ac = getCtx()
  if (!ac) return
  load(path).then((buf) => {
    if (!buf) return
    const src = ac.createBufferSource()
    const gain = ac.createGain()
    src.buffer = buf
    if (pitched) src.playbackRate.value = DG_SCALE[Math.floor(Math.random() * DG_SCALE.length)]
    gain.gain.value = vol * masterVol
    src.connect(gain)
    gain.connect(ac.destination)
    src.start()
  })
}

let muted = false
try {
  muted = window.matchMedia('(prefers-reduced-motion: reduce)').matches
} catch {}

let masterVol = 1

let preloaded = false
function preload() {
  if (preloaded) return
  preloaded = true
  const b = import.meta.env.BASE_URL + 'sfx/'
  ;['chime-hover.ogg', 'chime-click.ogg', 'chime-nav.ogg', 'chime-mini.ogg', 'chime-crt.ogg', 'paint-loop.ogg', 'paint-stamp.ogg']
    .forEach((f) => load(b + f))
  document.removeEventListener('pointerdown', preload)
  document.removeEventListener('keydown', preload)
}
document.addEventListener('pointerdown', preload, { once: true })
document.addEventListener('keydown', preload, { once: true })

const base = () => import.meta.env.BASE_URL + 'sfx/'

let paintLoop: { src: AudioBufferSourceNode; gain: GainNode } | null = null

export const sfx = {
  btnHover:  () => play(base() + 'chime-hover.ogg', 0.5, true),
  btnClick:  () => play(base() + 'chime-click.ogg', 0.55, true),
  cardHover: () => play(base() + 'chime-hover.ogg', 0.45, true),
  miniHover: () => play(base() + 'chime-mini.ogg', 0.45, true),
  navClick:  () => play(base() + 'chime-nav.ogg', 0.55, true),
  crtClick:  () => play(base() + 'chime-crt.ogg', 0.55),
  paintStart: () => {
    if (muted || paintLoop) return
    const ac = getCtx()
    if (!ac) return
    if (ac.state === 'suspended') void ac.resume()
    load(base() + 'paint-loop.ogg').then((buf) => {
      if (!buf || paintLoop) return
      const src = ac.createBufferSource()
      const g = ac.createGain()
      src.buffer = buf
      src.loop = true
      g.gain.value = 0
      src.connect(g)
      g.connect(ac.destination)
      src.start()
      g.gain.linearRampToValueAtTime(0.8 * masterVol, ac.currentTime + 0.15)
      paintLoop = { src, gain: g }
    })
  },
  paintStop: () => {
    if (!paintLoop) return
    const ac = getCtx()
    if (!ac) return
    const { src, gain } = paintLoop
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3)
    setTimeout(() => { try { src.stop() } catch {} }, 400)
    paintLoop = null
  },
  paintStamp: () => play(base() + 'paint-stamp.ogg', 0.95),
  setVolume: (v: number) => {
    masterVol = v
    if (paintLoop) {
      const ac = getCtx()
      if (ac) paintLoop.gain.gain.linearRampToValueAtTime(0.8 * masterVol, ac.currentTime + 0.1)
    }
  },
  mute:      () => { muted = true },
  unmute:    () => { muted = false },
  isMuted:   () => muted,
}
