import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// We don't enable Vitest globals, so RTL's auto-cleanup doesn't register.
// Unmount between tests ourselves, or repeated renders stack in the DOM.
afterEach(() => cleanup())

// jsdom ships no matchMedia; the shell's visualizer reads it on mount.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}
