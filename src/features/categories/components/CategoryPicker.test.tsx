// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import {
  catId,
  defaultCategoryRows,
} from '#/features/categories/__fixtures__/categories'
import type { TxType } from '#/features/transactions/api/types'
import { CategoryPicker } from './CategoryPicker'

vi.setConfig({ testTimeout: 20000 })

beforeAll(async () => {
  await db.categories.bulkPut(defaultCategoryRows())
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(cleanup)

const renderPicker = async (
  over: { type?: TxType; categoryId?: string } = {},
) => {
  const onChange = vi.fn()
  render(
    <CategoryPicker
      type={over.type ?? 'spend'}
      categoryId={over.categoryId ?? catId('dining')}
      onChange={onChange}
    />,
  )
  await screen.findByRole('button', { name: /^Category: (?!Deleted)/ })
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
  it('builds no rows until it is opened', async () => {
    await renderPicker()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('names the parent and the child on the trigger', async () => {
    await renderPicker({ categoryId: catId('cafes', 'dining') })
    expect(
      screen.getByRole('button', { name: 'Category: Dining › Cafés' }),
    ).toBeDefined()
  })

  it('offers only the categories of the given type', async () => {
    await renderPicker({ type: 'income', categoryId: catId('salary') })
    open()
    const names = optionNames()
    expect(names).toContain('Salary')
    expect(names).toContain('Bonus')
    expect(names).not.toContain('Dining')
  })

  it("finds a parent's children by the parent's name", async () => {
    await renderPicker()
    open()
    search('dining')
    expect(optionNames().slice(0, 3)).toEqual([
      'Dining',
      'Restaurants',
      'Cafés',
    ])
  })

  it('picks a parent on its own', async () => {
    const onChange = await renderPicker({
      categoryId: catId('cafes', 'dining'),
    })
    open()
    search('groceries')
    fireEvent.click(screen.getByRole('option', { name: 'Groceries' }))
    expect(onChange).toHaveBeenCalledWith(catId('groceries'))
  })

  it('picks a child with its parent', async () => {
    const onChange = await renderPicker()
    open()
    search('bakery')
    expect(optionNames()).toEqual(['Groceries', 'Bakery'])
    fireEvent.click(screen.getByRole('option', { name: 'Bakery' }))
    expect(onChange).toHaveBeenCalledWith(catId('bakery', 'groceries'))
  })

  it('picks from the keyboard, starting on the best match', async () => {
    const onChange = await renderPicker()
    open()
    search('bakery')
    const input = screen.getByPlaceholderText(/search categories/i)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(catId('bakery', 'groceries'))
  })

  it('marks the current pick', async () => {
    await renderPicker({ categoryId: catId('cafes', 'dining') })
    open()
    const checked = screen
      .getAllByRole('option')
      .filter((o) => o.getAttribute('data-checked') === 'true')
    expect(checked.map((o) => o.textContent)).toEqual(['Cafés'])
  })
})
