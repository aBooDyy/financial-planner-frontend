// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useAppConfigStore } from '#/lib/config/appConfig'
import { usePreferencesStore } from '#/stores/preferences'
import { CurrencyPicker } from './CurrencyPicker'
import type { CurrencyMeta } from '#/lib/config/appConfig'

const CURRENCIES: CurrencyMeta[] = [
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', minorUnit: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', minorUnit: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', minorUnit: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', minorUnit: 0 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', minorUnit: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnit: 2 },
]

const open = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Currency' }))

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(/search currency/i), {
    target: { value: text },
  })

const options = () => screen.queryAllByRole('option')

const optionCodes = () => options().map((o) => o.textContent.slice(-3))

// Mounting a portalled popover full of rows in jsdom is slow the first time around.
vi.setConfig({ testTimeout: 20000 })

beforeAll(() => {
  // jsdom ships neither, and Radix's popper and cmdk's scroll-into-view both call them.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false

  useAppConfigStore.setState({
    config: { ...useAppConfigStore.getState().config, currencies: CURRENCIES },
    byCode: new Map(CURRENCIES.map((c) => [c.code, c])),
  })
})

afterEach(() => {
  cleanup()
  usePreferencesStore.setState({ recentCurrencies: [] })
})

describe('CurrencyPicker', () => {
  it('builds no option rows until it is opened', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} />)
    expect(options()).toHaveLength(0)
  })

  it('offers the base currency and the current value up top, then the whole table', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} base="USD" />)
    open()

    expect(screen.getByText('Frequent')).toBeDefined()
    expect(optionCodes()).toEqual([
      'USD',
      'SAR',
      ...CURRENCIES.map((c) => c.code),
    ])
  })

  it('drops the frequent group and ranks the best match first while searching', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} base="USD" />)
    open()
    search('euro')

    expect(screen.queryByText('Frequent')).toBeNull()
    expect(optionCodes()[0]).toBe('EUR')
    expect(optionCodes()).not.toContain('JPY')
  })

  it('says so when nothing matches', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} />)
    open()
    search('zzzzzz')

    expect(screen.getByText('No currency matches.')).toBeDefined()
    expect(options()).toHaveLength(0)
  })

  it('keeps the top match highlighted as the results change', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} base="USD" />)
    open()
    search('doll')

    const highlighted = options().filter(
      (o) => o.getAttribute('aria-selected') === 'true',
    )
    expect(highlighted.map((o) => o.textContent.slice(-3))).toEqual(['AUD'])
  })

  it('moves the highlight with the arrow keys', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} base="USD" />)
    open()
    search('doll')
    fireEvent.keyDown(screen.getByPlaceholderText(/search currency/i), {
      key: 'ArrowDown',
    })

    const highlighted = options().filter(
      (o) => o.getAttribute('aria-selected') === 'true',
    )
    expect(highlighted.map((o) => o.textContent.slice(-3))).toEqual(['USD'])
  })

  it('reports the picked code and closes', () => {
    const onChange = vi.fn()
    render(<CurrencyPicker value="SAR" onChange={onChange} base="USD" />)
    open()
    search('euro')
    fireEvent.click(options()[0])

    expect(onChange).toHaveBeenCalledWith('EUR')
    expect(options()).toHaveLength(0)
  })

  it('starts each opening with an empty search', () => {
    render(<CurrencyPicker value="SAR" onChange={() => {}} base="USD" />)
    open()
    search('euro')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    open()

    expect(screen.getByPlaceholderText(/search currency/i)).toHaveProperty(
      'value',
      '',
    )
    expect(screen.getByText('Frequent')).toBeDefined()
  })
})
