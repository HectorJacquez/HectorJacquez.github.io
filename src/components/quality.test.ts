import { describe, it, expect } from 'vitest'
import { stepQuality, qualityOverride } from './quality'

describe('stepQuality', () => {
  it('steps down one level when performance declines, never below 0', () => {
    expect(stepQuality(2, 'decline')).toBe(1)
    expect(stepQuality(1, 'decline')).toBe(0)
    expect(stepQuality(0, 'decline')).toBe(0)
  })

  it('steps back up when performance recovers, never above 2', () => {
    expect(stepQuality(0, 'incline')).toBe(1)
    expect(stepQuality(2, 'incline')).toBe(2)
  })

  it('drops straight to the floor on fallback', () => {
    expect(stepQuality(2, 'fallback')).toBe(0)
  })
})

describe('qualityOverride', () => {
  it('reads a forced level from the URL', () => {
    expect(qualityOverride('?quality=0')).toBe(0)
    expect(qualityOverride('?quality=1')).toBe(1)
    expect(qualityOverride('?x=1&quality=2')).toBe(2)
  })

  it('ignores missing or junk values', () => {
    expect(qualityOverride('')).toBeNull()
    expect(qualityOverride('?quality=9')).toBeNull()
    expect(qualityOverride('?quality=high')).toBeNull()
  })
})
