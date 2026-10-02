// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SpendClassChip } from './SpendClassChip'

vi.setConfig({ testTimeout: 20000 })

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

const open = (name: RegExp) =>
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' })

describe('SpendClassChip', () => {
  it('shows a root its own tag and offers not sorted', () => {
    const onChange = vi.fn()
    render(
      <SpendClassChip categoryName="Dining" value="want" onChange={onChange} />,
    )

    open(/^Dining: Wants\. Change$/)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Needs' }))
    expect(onChange).toHaveBeenCalledWith('need')

    open(/^Dining: Wants/)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Not sorted' }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('shows an untagged subcategory its root tag, and lets it follow the root again', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <SpendClassChip
        categoryName="Taxi"
        value={null}
        inherits={{ name: 'Transport', value: 'need' }}
        onChange={onChange}
      />,
    )

    open(/^Taxi: Needs, from Transport\. Change$/)
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Wants' }))
    expect(onChange).toHaveBeenCalledWith('want')

    rerender(
      <SpendClassChip
        categoryName="Taxi"
        value="want"
        inherits={{ name: 'Transport', value: 'need' }}
        onChange={onChange}
      />,
    )
    open(/^Taxi: Wants\. Change$/)
    fireEvent.click(
      screen.getByRole('menuitemradio', {
        name: 'Same as Transport · Needs',
      }),
    )
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('reads a root without a tag as not sorted', () => {
    render(
      <SpendClassChip categoryName="Other" value={null} onChange={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: 'Other: Not sorted. Change' }),
    ).toBeTruthy()
  })
})
