// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

// Mounting a portalled menu in jsdom is slow the first time around.
vi.setConfig({ testTimeout: 20000 })

const OPTIONS = ['one', 'two', 'three']

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

afterEach(cleanup)

const Menu = () => (
  <Select defaultValue="two">
    <SelectTrigger aria-label="Pick one">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {OPTIONS.map((o) => (
        <SelectItem key={o} value={o}>
          {o}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

describe('SelectContent', () => {
  it('anchors to the trigger instead of measuring every item to align one', () => {
    render(<Menu />)
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Pick one' }), {
      key: 'ArrowDown',
    })

    // `item-aligned` positions the menu itself; only `popper` uses a popper wrapper.
    expect(
      document.querySelector('[data-radix-popper-content-wrapper]'),
    ).not.toBeNull()
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      OPTIONS,
    )
  })
})
