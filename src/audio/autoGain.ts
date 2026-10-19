export interface AutoGainOpts { decay?: number; floor?: number }
export interface AutoGainResult { gain: number; peak: number }
// Not implemented yet -- the spec in autoGain.test.ts drives this (TDD red step).
export function autoGain(_value: number, _peak: number, _opts: AutoGainOpts = {}): AutoGainResult {
  return { gain: 0, peak: 0 }
}
