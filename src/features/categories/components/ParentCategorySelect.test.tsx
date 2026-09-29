// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '#/components/ui/tooltip'
import {
  catId,
  defaultCatalog,
} from '#/features/categories/__fixtures__/categories'
import { ParentCategorySelect } from './ParentCategorySelect'

// Mounting a portalled menu in jsdom is slow the first time around.
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

const catalog = defaultCatalog()
const options = catalog.byType('spend').slice(0, 3)
const WHY = 'Groceries already has a subcategory called “Cafés”.'

const renderSelect = (props: {
  locked?: string | null
  blocked?: ReadonlyMap<string | null, string>
}) =>
  render(
    <TooltipProvider>
      <ParentCategorySelect
        id="parent"
        value={null}
        options={options}
        noneLabel="Top level"
        onChange={vi.fn()}
        {...props}
      />
    </TooltipProvider>,
  )

describe('ParentCategorySelect', () => {
  it('disables a blocked choice and says why when it is tapped', () => {
    renderSelect({ blocked: new Map([[catId('groceries'), WHY]]) })
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })

    const groceries = screen.getByRole('option', { name: /Groceries/ })
    expect(groceries.getAttribute('aria-disabled')).toBe('true')
    expect(
      screen
        .getByRole('option', { name: /Dining/ })
        .hasAttribute('aria-disabled'),
    ).toBe(false)

    fireEvent.click(groceries)
    expect(screen.getByRole('tooltip').textContent).toContain(WHY)
  })

  it('turns the whole select off when it is locked, and says why', () => {
    const why = 'Dining has subcategories.'
    renderSelect({ locked: why })

    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true)
    const reason = screen.getByLabelText(why)
    fireEvent.focus(reason)
    expect(screen.getByRole('tooltip').textContent).toContain(why)
  })
})
