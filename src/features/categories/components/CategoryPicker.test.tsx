// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TxType } from '#/features/transactions/api/types'
import { CategoryPicker } from './CategoryPicker'

vi.setConfig({ testTimeout: 20000 })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(cleanup)

const renderPicker = (
  over: { type?: TxType; category?: string; subcategory?: string | null } = {},
) => {
  const onChange = vi.fn()
  render(
    <CategoryPicker
      type={over.type ?? 'spend'}
      category={over.category ?? 'dining'}
      subcategory={over.subcategory ?? null}
      onChange={onChange}
    />,
  )
  return onChange
}

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: /^Category:/ }))

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/search categories/i), {
    target: { value: text },
  })

const optionNames = () =>
  screen.queryAllByRole('option').map((o) => o.textContent)

describe('CategoryPicker', () => {
  it('builds no rows until it is opened', () => {
    renderPicker()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('names the parent and the child on the trigger', () => {
    renderPicker({ category: 'dining', subcategory: 'cafes' })
    expect(
      screen.getByRole('button', { name: 'Category: Dining › Cafés' }),
    ).toBeDefined()
  })

  it('offers only the categories of the given type', () => {
    renderPicker({ type: 'income', category: 'salary' })
    open()
    const names = optionNames()
    expect(names).toContain('Salary')
    expect(names).toContain('Bonus')
    expect(names).not.toContain('Dining')
  })

  it("finds a parent's children by the parent's name", () => {
    renderPicker()
    open()
    search('dining')
    expect(optionNames().slice(0, 3)).toEqual([
      'Dining',
      'Restaurants',
      'Cafés',
    ])
  })

  it('picks a parent on its own', () => {
    const onChange = renderPicker({ category: 'dining', subcategory: 'cafes' })
    open()
    search('groceries')
    fireEvent.click(screen.getByRole('option', { name: 'Groceries' }))
    expect(onChange).toHaveBeenCalledWith('groceries', null)
  })

  it('picks a child with its parent', () => {
    const onChange = renderPicker()
    open()
    search('bakery')
    expect(optionNames()).toEqual(['Groceries', 'Bakery'])
    fireEvent.click(screen.getByRole('option', { name: 'Bakery' }))
    expect(onChange).toHaveBeenCalledWith('groceries', 'bakery')
  })

  it('picks from the keyboard, starting on the best match', () => {
    const onChange = renderPicker()
    open()
    search('bakery')
    const input = screen.getByPlaceholderText(/search categories/i)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('groceries', 'bakery')
  })

  it('marks the current pick', () => {
    renderPicker({ category: 'dining', subcategory: 'cafes' })
    open()
    const checked = screen
      .getAllByRole('option')
      .filter((o) => o.getAttribute('data-checked') === 'true')
    expect(checked.map((o) => o.textContent)).toEqual(['Cafés'])
  })
})
