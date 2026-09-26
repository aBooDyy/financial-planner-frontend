// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { useStubImport } from '#/features/import/__fixtures__/useStubImport'
import { useReviewRows } from '#/features/import/hooks/useReviewRows'
import { emptyAliases } from '#/features/import/data/types'
import { ReviewStep } from './ReviewStep'
import type { StubSeed } from '#/features/import/__fixtures__/useStubImport'
import type * as RowScan from '#/features/import/data/rowScan'

/**
 * The review table over a file far larger than a screen. What is counted here is how many
 * rows are **built**, not how many are painted: a table that windows its DOM but derives
 * every row first has moved the cost, not removed it.
 */

const ROWS = 5000

const built = { rows: 0 }

vi.mock('#/features/import/data/rowScan', async (original) => {
  const actual: typeof RowScan = await original()
  return {
    ...actual,
    rowReader: (input: RowScan.RowReaderInput) => {
      const reader = actual.rowReader(input)
      return {
        at: (index: number) => {
          built.rows += 1
          return reader.at(index)
        },
      }
    },
  }
})

const HEADERS = ['Date', 'Description', 'Amount', 'Account', 'Category']

const MATRIX: string[][] = Array.from({ length: ROWS }, (_unused, at) => [
  `2026-08-${String((at % 28) + 1).padStart(2, '0')}`,
  `SHOP ${at}`,
  `-${((at % 900) + 1) / 100}`,
  'Main',
  'Groceries',
])

const WALLETS = [{ label: null, wallets: [{ id: 'w1', name: 'Main' }] }]

const ANSWERED = () => ({
  ...emptyAliases(),
  wallets: { main: { kind: 'wallet' as const, walletId: 'w1' } },
  categories: {
    groceries: {
      kind: 'category' as const,
      categoryId: 'cat-groceries',
    },
  },
})

function Harness(seed: StubSeed) {
  const csv = useStubImport(seed)
  const review = useReviewRows(csv)
  return (
    <ReviewStep
      csv={csv}
      draft={csv.draft!}
      review={review}
      onBack={() => undefined}
      onCommit={() => undefined}
    />
  )
}

const renderStep = () =>
  render(
    <Harness
      headers={HEADERS}
      matrix={MATRIX}
      walletGroups={WALLETS}
      walletCurrencies={{ w1: 'SAR' }}
      amend={(draft) => ({ ...draft, aliases: ANSWERED() })}
    />,
  )

const grid = () => screen.getByRole('grid')

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList
})

afterEach(cleanup)

describe('the review table at 5 000 rows', () => {
  beforeEach(() => {
    built.rows = 0
  })

  it('counts and orders the whole file without building a row of it', () => {
    renderStep()

    expect(
      screen.getByRole('button', { name: /^Import / }).textContent,
    ).toContain('Import 5,000 transactions')
    expect(grid().getAttribute('aria-rowcount')).toBe(String(ROWS))
    // A window of rows, not a file of them.
    expect(built.rows).toBeLessThan(60)
    expect(screen.getAllByRole('row').length).toBeLessThan(40)
  })

  it('builds only the rows a scroll brings into the window', () => {
    renderStep()
    const afterFirstPaint = built.rows

    for (const top of [1000, 2000, 3000]) {
      grid().scrollTop = top
      fireEvent.scroll(grid())
    }

    // Three screenfuls in: three windows' worth of rows, nowhere near the file.
    expect(built.rows - afterFirstPaint).toBeLessThan(120)
    expect(built.rows).toBeLessThan(200)
    expect(screen.getAllByRole('row').length).toBeLessThan(40)
  })

  it('keeps row identity stable so a scroll of one row is not a window of work', () => {
    renderStep()
    const afterFirstPaint = built.rows

    // A scroll that stays inside the rows already on screen costs nothing at all.
    grid().scrollTop = 20
    fireEvent.scroll(grid())
    expect(built.rows).toBe(afterFirstPaint)
  })

  it('filters the whole file from the pass, still without building rows', () => {
    renderStep()
    const afterFirstPaint = built.rows

    fireEvent.click(screen.getByRole('radio', { name: /Errors/ }))

    expect(screen.getByText('No rows match this filter.')).toBeDefined()
    expect(built.rows).toBe(afterFirstPaint)
  })
})
