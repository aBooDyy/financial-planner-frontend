// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { SegmentedBar } from './SegmentedBar'
import { TooltipProvider } from './ui/tooltip'

// Mounting a portalled tooltip in jsdom is slow the first time around.
vi.setConfig({ testTimeout: 20000 })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

afterEach(cleanup)

const SEGMENTS = [
  {
    key: 'food',
    label: 'Groceries',
    color: '#1F9D6B',
    pct: 70,
    valueStr: 'SR 700',
    pctStr: '70% of outflow',
  },
  {
    key: 'fuel',
    label: 'Fuel',
    color: '#3B82F6',
    pct: 30,
    valueStr: 'SR 300',
    pctStr: '30% of outflow',
  },
]

const renderBar = () =>
  render(
    <TooltipProvider>
      <SegmentedBar segments={SEGMENTS} />
    </TooltipProvider>,
  )

const segment = (name: RegExp) => screen.getByRole('button', { name })

describe('SegmentedBar', () => {
  it('reveals a segment on hover and hides it when the pointer leaves', () => {
    renderBar()
    fireEvent.pointerEnter(segment(/Groceries/), { pointerType: 'mouse' })
    expect(screen.getAllByText('SR 700').length).toBeGreaterThan(0)

    fireEvent.pointerLeave(segment(/Groceries/).parentElement!, {
      pointerType: 'mouse',
    })
    expect(screen.queryByText('SR 700')).toBeNull()
  })

  it('opens on tap and stays open once the touch lifts', () => {
    renderBar()
    const fuel = segment(/Fuel/)
    fireEvent.pointerEnter(fuel, { pointerType: 'touch' })
    fireEvent.click(fuel)
    fireEvent.pointerLeave(fuel.parentElement!, { pointerType: 'touch' })
    expect(screen.getAllByText('SR 300').length).toBeGreaterThan(0)

    fireEvent.click(fuel)
    expect(screen.queryByText('SR 300')).toBeNull()
  })

  it('closes when something outside the bar is pressed', () => {
    renderBar()
    fireEvent.click(segment(/Groceries/))
    expect(screen.getAllByText('SR 700').length).toBeGreaterThan(0)

    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('SR 700')).toBeNull()
  })

  it('names each segment for assistive tech', () => {
    renderBar()
    expect(segment(/^Groceries: SR 700, 70% of outflow$/)).toBeTruthy()
  })
})
