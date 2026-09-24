// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CountsOption } from '#/features/transactions/data/countsToward'
import { CountsTowardMore } from './CountsTowardMore'

beforeAll(() => {
  // jsdom ships neither, and Radix's popper and cmdk's scroll-into-view both call them.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
})

afterEach(cleanup)

const option = (id: string, name: string, sub: string): CountsOption => ({
  id,
  name,
  sub,
  color: '#1F9D6B',
  kind: 'goal',
})

const OPTIONS = [
  option('car', 'New car', 'Goal · SR 4,000 of 40,000'),
  option('gym', 'Gym membership', 'Obligation · SR 250 due Oct 3'),
  option('wedding', 'Wedding', 'Goal · SR 14,000 of 60,000'),
]

const renderMore = (isIncome = false) => {
  const onSelect = vi.fn()
  render(
    <CountsTowardMore
      options={OPTIONS}
      isIncome={isIncome}
      onSelect={onSelect}
    />,
  )
  return onSelect
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'More' }))
const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/^Search/), {
    target: { value: text },
  })
const names = () =>
  screen
    .queryAllByRole('option')
    .map((o) => o.querySelector('.font-semibold')?.textContent)

describe('CountsTowardMore', () => {
  it('says how many more there are and builds no rows until opened', () => {
    renderMore()
    expect(screen.getByText('Search 3 more')).toBeDefined()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('lists every option with its sub-line', () => {
    renderMore()
    open()
    expect(names()).toEqual(['New car', 'Gym membership', 'Wedding'])
    expect(screen.getByText('Obligation · SR 250 due Oct 3')).toBeDefined()
  })

  it('searches names, not the figures in the sub-line', () => {
    renderMore()
    open()
    search('wed')
    expect(names()).toEqual(['Wedding'])
    search('4,000')
    expect(names()).toEqual([])
    expect(screen.getByText('No goal matches.')).toBeDefined()
  })

  it('picks like a card and closes', () => {
    const onSelect = renderMore()
    open()
    search('gym')
    fireEvent.click(screen.getByRole('option'))
    expect(onSelect).toHaveBeenCalledWith('gym')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('picks the top match with Enter', () => {
    const onSelect = renderMore()
    open()
    search('car')
    fireEvent.keyDown(screen.getByPlaceholderText(/^Search/), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('car')
  })

  it('talks about income streams on an income entry', () => {
    renderMore(true)
    open()
    expect(screen.getByPlaceholderText('Search income streams…')).toBeDefined()
    search('zzz')
    expect(screen.getByText('No income stream matches.')).toBeDefined()
  })
})
