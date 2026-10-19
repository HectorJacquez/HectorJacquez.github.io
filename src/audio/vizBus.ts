/** Shared, non-reactive bridge between the player and the edge visualizer.
 *  The player builds the Web Audio graph on first play and publishes its
 *  analyser here; the visualizer's rAF loop reads it every frame. Kept out of
 *  React state on purpose, so 60fps reads never trigger re-renders. */
export interface VizBus {
  analyser: AnalyserNode | null
  data: Uint8Array<ArrayBuffer> | null
  playing: boolean
}

export const vizBus: VizBus = { analyser: null, data: null, playing: false }

/** Build the analyser graph off an audio element once, publishing it to the bus.
 *  Returns the AudioContext so the caller can resume it on a user gesture. */
export function connectAnalyser(el: HTMLAudioElement): AudioContext | null {
  if (vizBus.analyser) return null // already wired
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null // no Web Audio: the track still plays, just no reactive viz
  const ctx = new AC()
  const src = ctx.createMediaElementSource(el)
  const an = ctx.createAnalyser()
  an.fftSize = 1024
  src.connect(an)
  an.connect(ctx.destination)
  vizBus.analyser = an
  vizBus.data = new Uint8Array(an.frequencyBinCount)
  return ctx
}
