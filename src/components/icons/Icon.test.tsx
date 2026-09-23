// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Icon } from './Icon'
import { PATHS } from '#/lib/icons/paths.gen'

afterEach(cleanup)

const svgOf = (container: HTMLElement) =>
  container.querySelector('svg') as SVGSVGElement

describe('Icon', () => {
  it('holds a sized transparent box, then draws the path once the chunk resolves', async () => {
    const { container } = render(<Icon id="piggy-bank" size={24} />)
    const svg = svgOf(container)

    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
    expect(svg.getAttribute('viewBox')).toBe('0 0 256 256')
    expect(svg.querySelector('path')).toBeNull()

    await waitFor(() => expect(svg.querySelector('path')).not.toBeNull())
    const paths = svg.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttribute('d')).toBe(PATHS['piggy-bank'])
  })

  it('is aria-hidden without a title', async () => {
    const { container } = render(<Icon id="wallet" />)
    const svg = svgOf(container)

    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('role')).toBeNull()
    expect(svg.getAttribute('width')).toBe('20')
    await waitFor(() => expect(svg.querySelector('path')).not.toBeNull())
  })

  it('becomes an image with a title', async () => {
    const { container } = render(<Icon id="wallet" title="Cash wallet" />)
    const svg = svgOf(container)

    expect(svg.getAttribute('aria-hidden')).toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.querySelector('title')?.textContent).toBe('Cash wallet')
    await waitFor(() => expect(svg.querySelector('path')).not.toBeNull())
  })

  it('takes its colour from CSS, not from a fill attribute', () => {
    const { container } = render(<Icon id="wallet" />)
    expect(svgOf(container).getAttribute('fill')).toBe('currentColor')
  })
})
