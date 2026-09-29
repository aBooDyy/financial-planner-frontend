// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_SEARCH_FILTERS } from '#/features/search/data/types'
import type {
  ActiveFilterChip,
  SearchContext,
  SearchView,
} from '#/features/search/data/types'
import type { SearchFilterOptions } from '#/features/search/hooks/useSearchFilterOptions'
import { useSearchStore } from '#/features/search/stores/search'
import { SearchSheet } from './SearchSheet'
import { SearchTrigger } from './SearchTrigger'

const IDLE: SearchView = {
  idle: true,
  idleText: 'Search every transaction, budget, recurring item and account.',
  groups: [],
  total: 0,
  empty: false,
  headline: '',
  scopeNote: '',
  moreElsewhere: 0,
}

const FOUND: SearchView = {
  idle: false,
  idleText: '',
  groups: [
    {
      key: 'transactions',
      title: 'Transactions',
      count: 1,
      rows: [
        {
          key: 'tx-1',
          target: { kind: 'tx', id: 'tx-1' },
          title: 'Blue Bottle',
          sub: 'Dining · Main · 12 Sep',
          valueStr: '−€4.50',
          positive: false,
          color: '#E8833A',
          iconId: null,
        },
      ],
    },
  ],
  total: 1,
  empty: false,
  headline: '1 result for “blue”',
  scopeNote: 'All tabs · all accounts · all dates',
  moreElsewhere: 0,
}

const searchView = vi.fn(
  (_args: {
    wide: boolean
  }): { loading: boolean; view: SearchView | null } => ({
    loading: false,
    view: IDLE,
  }),
)
const openTarget = vi.fn()
let options: SearchFilterOptions = {
  roots: [],
  wallets: [],
  baseSymbol: '€',
  chips: [],
}

vi.mock('#/features/search/hooks/useSearchView', () => ({
  useSearchView: (args: { wide: boolean }) => searchView(args),
}))
vi.mock('#/features/search/hooks/useSearchFilterOptions', () => ({
  useSearchFilterOptions: () => options,
}))
vi.mock('#/features/search/hooks/useOpenSearchTarget', () => ({
  useOpenSearchTarget: () => openTarget,
}))
vi.mock('#/features/categories/hooks/useCategoryCatalog', async () => {
  const fixtures = await import('#/features/categories/__fixtures__/categories')
  const catalog = fixtures.defaultCatalog()
  return { useCategoryCatalog: () => catalog }
})

const CONTEXT: SearchContext = {
  view: 'activity',
  scope: { type: 'wallet', id: 'w1' },
  scopeLabel: 'Main',
}

const renderSheet = () =>
  render(
    <>
      <SearchTrigger />
      <SearchSheet />
    </>,
  )

const openSheet = () => {
  renderSheet()
  fireEvent.click(screen.getByRole('button', { name: /Search everything/ }))
  return screen.getByRole('dialog')
}

beforeEach(() => {
  searchView.mockImplementation(() => ({ loading: false, view: IDLE }))
  openTarget.mockReset()
  options = { roots: [], wallets: [], baseSymbol: '€', chips: [] }
})
afterEach(() => {
  cleanup()
  act(() => {
    useSearchStore.getState().closeSearch()
    useSearchStore.getState().setContext(null)
  })
})

describe('SearchSheet', () => {
  it('opens from the top-bar trigger with the query field focused', () => {
    openSheet()
    const input = screen.getByRole('textbox', { name: 'Search' })
    expect(document.activeElement).toBe(input)
    expect(screen.getByText(IDLE.idleText)).toBeTruthy()
  })

  it('opens from the mobile icon trigger too', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes on Escape and forgets the query', () => {
    openSheet()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'blue' },
    })
    expect(useSearchStore.getState().query).toBe('blue')
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), {
      key: 'Escape',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(useSearchStore.getState().query).toBe('')
  })

  it('closes on Cancel and resets filters and scope', () => {
    act(() => useSearchStore.getState().setContext(CONTEXT))
    openSheet()
    act(() => {
      useSearchStore.getState().setWide(false)
      useSearchStore.getState().setFilters({ type: 'spend' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const s = useSearchStore.getState()
    expect(s.wide).toBe(true)
    expect(s.filters).toEqual(EMPTY_SEARCH_FILTERS)
  })

  it('defaults to Everywhere and narrows to the tab on screen', () => {
    act(() => useSearchStore.getState().setContext(CONTEXT))
    openSheet()
    const narrow = screen.getByRole('button', { name: 'Activity · Main' })
    const everywhere = screen.getByRole('button', { name: 'Everywhere' })
    expect(everywhere.getAttribute('aria-pressed')).toBe('true')
    expect(narrow.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(narrow)
    expect(narrow.getAttribute('aria-pressed')).toBe('true')
    expect(searchView).toHaveBeenLastCalledWith(
      expect.objectContaining({ wide: false }),
    )

    fireEvent.click(everywhere)
    expect(searchView).toHaveBeenLastCalledWith(
      expect.objectContaining({ wide: true }),
    )
  })

  it('offers no narrow chip off the Spending page', () => {
    openSheet()
    expect(screen.queryByRole('button', { name: /Activity ·/ })).toBeNull()
    expect(
      screen
        .getByRole('button', { name: 'Everywhere' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('counts the filters in force on the Filters button', () => {
    act(() =>
      useSearchStore
        .getState()
        .setFilters({ type: 'spend', walletIds: ['w1', 'w2'] }),
    )
    openSheet()
    expect(
      screen.getByRole('button', { name: 'Filters, 3 active' }),
    ).toBeTruthy()
  })

  it('removes one active filter chip, or all of them', () => {
    const typeChip: ActiveFilterChip = {
      key: 'type',
      label: 'Spending',
      remove: (f) => ({ ...f, type: 'any' }),
    }
    const walletChip: ActiveFilterChip = {
      key: 'w1',
      label: 'Main · Everyday',
      remove: (f) => ({ ...f, walletIds: [] }),
    }
    options = { ...options, chips: [typeChip, walletChip] }
    act(() =>
      useSearchStore
        .getState()
        .setFilters({ type: 'spend', walletIds: ['w1'] }),
    )
    openSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Spending' }))
    expect(useSearchStore.getState().filters.type).toBe('any')
    expect(useSearchStore.getState().filters.walletIds).toEqual(['w1'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(useSearchStore.getState().filters).toEqual(EMPTY_SEARCH_FILTERS)
  })

  it('hides the active chips while the filter panel is open', () => {
    options = {
      ...options,
      chips: [
        {
          key: 'type',
          label: 'Spending',
          remove: (f) => ({ ...f, type: 'any' }),
        },
      ],
    }
    act(() => useSearchStore.getState().setFilters({ type: 'spend' }))
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    expect(screen.queryByRole('button', { name: 'Remove Spending' })).toBeNull()
    expect(screen.getByRole('radiogroup', { name: 'Type' })).toBeTruthy()
  })

  it('shows how many results the filters leave, and closes the panel on it', () => {
    searchView.mockImplementation(() => ({ loading: false, view: FOUND }))
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Income' }))
    expect(useSearchStore.getState().filters.type).toBe('income')

    fireEvent.click(screen.getByRole('button', { name: 'Show 1 result' }))
    expect(screen.queryByRole('radiogroup', { name: 'Type' })).toBeNull()
  })

  it('opens the result that is clicked', () => {
    searchView.mockImplementation(() => ({ loading: false, view: FOUND }))
    openSheet()
    expect(screen.getByText(/1 result for “blue”/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Blue Bottle/ }))
    expect(openTarget).toHaveBeenCalledWith({ kind: 'tx', id: 'tx-1' })
  })

  it('offers to widen when other tabs hold more matches', () => {
    searchView.mockImplementation(() => ({
      loading: false,
      view: { ...FOUND, moreElsewhere: 4 },
    }))
    act(() => {
      useSearchStore.getState().setContext(CONTEXT)
    })
    openSheet()
    act(() => useSearchStore.getState().setWide(false))
    fireEvent.click(
      screen.getByRole('button', {
        name: /4 more matches in other tabs and accounts/,
      }),
    )
    expect(useSearchStore.getState().wide).toBe(true)
  })

  it('holds placeholder rows while the results load', () => {
    searchView.mockImplementation(() => ({ loading: true, view: null }))
    const dialog = openSheet()
    expect(
      dialog.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0)
  })

  it('says so when nothing matches', () => {
    searchView.mockImplementation(() => ({
      loading: false,
      view: { ...FOUND, groups: [], total: 0, empty: true },
    }))
    openSheet()
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
  })
})
