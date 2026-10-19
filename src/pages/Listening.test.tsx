import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Listening } from './Listening'

describe('Listening page', () => {
  it('renders every chart section and its data', () => {
    render(<Listening />)
    for (const title of ['Every month since 2014', 'The all-time ten', 'The shape of my library', 'The listening clock']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
    // a data-driven value that only appears if a chart/table actually rendered
    expect(screen.getAllByText(/Aphex Twin/).length).toBeGreaterThan(0)
    expect(document.querySelectorAll('svg').length).toBeGreaterThanOrEqual(4)
  })
})
