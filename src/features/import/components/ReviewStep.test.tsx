// @vitest-environment jsdom
import { useMemo } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useStubImport } from '#/features/import/__fixtures__/useStubImport'
import { useReviewRows } from '#/features/import/hooks/useReviewRows'
import { emptyAliases } from '#/features/import/data/types'
import { ReviewStep } from './ReviewStep'
import type { StubSeed } from '#/features/import/__fixtures__/useStubImport'

const HEADERS = ['Date', 'Description', 'Amount', 'Account', 'Category']

const MATRIX = [
  ['2026-08-01', 'CARREFOUR HYPER', '-142.50', 'Main', 'Groceries'],
  ['2026-08-02', 'STC', '-89.00', 'Main', 'Groceries'],
  ['2026-08-04', 'ATM WITHDRAWAL', '-500.00', 'Main', 'Groceries'],
  ['2026-08-05', 'CORNER SHOP', '-34.00', 'Main', ''],
  ['2026-08-06', 'REFUND', 'N/A', 'Main', 'Groceries'],
]

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

function Harness({ onCommit, ...seed }: StubSeed & { onCommit?: () => void }) {
  const csv = useStubImport(seed)
  const review = useReviewRows(csv)
  return (
    <>
      <ReviewStep
        csv={csv}
        draft={csv.draft!}
        review={review}
        onBack={() => undefined}
        onCommit={onCommit ?? (() => undefined)}
      />
      <button
        type="button"
        onClick={() => review.editRow(4, { amountMinor: 3400 })}
      >
        fix the refund
      </button>
    </>
  )
}

const renderStep = (seed: Partial<StubSeed> & { onCommit?: () => void } = {}) =>
  render(
    <Harness
      headers={HEADERS}
      matrix={MATRIX}
      walletGroups={WALLETS}
      walletCurrencies={{ w1: 'SAR' }}
      amend={(draft) => ({ ...draft, aliases: ANSWERED() })}
      {...seed}
    />,
  )

/**
 * The step while a pass is running underneath it. A background pull invalidates the pass, so
 * the spine hands the step a result of null — and every object below it rebuilt, which is
 * the other half of the same defect: `draft.defaults` is a new object on every render.
 */
function RescanHarness({
  scanning,
  ...seed
}: StubSeed & { scanning: boolean }) {
  const csv = useStubImport(seed)
  const during = useMemo(
    () =>
      scanning
        ? { ...csv, scan: { ...csv.scan, running: true, result: null } }
        : csv,
    [csv, scanning],
  )
  const review = useReviewRows(during)
  return (
    <ReviewStep
      csv={during}
      draft={{ ...during.draft!, defaults: { ...during.draft!.defaults } }}
      review={review}
      onBack={() => undefined}
      onCommit={() => undefined}
    />
  )
}

const commitButton = () => screen.getByRole('button', { name: /^Import / })

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

// `globals` is off in this project, so Testing Library's auto-cleanup never registers.
afterEach(cleanup)

describe('ReviewStep', () => {
  it('counts every row by what it is', () => {
    renderStep()

    expect(
      screen.getByText(
        /5 rows · ✅ 3 ready · ⚠ 1 warnings · ⛔ 1 errors/,
      ),
    ).toBeDefined()
    expect(commitButton().textContent).toContain('Import 4 transactions')
  })

  it('filters the visible rows and scopes the header checkbox to them', () => {
    renderStep()

    fireEvent.click(screen.getByRole('radio', { name: /Errors/ }))
    expect(screen.getAllByRole('row')).toHaveLength(1)

    fireEvent.click(screen.getByRole('radio', { name: /Warnings/ }))
    expect(screen.getAllByRole('row')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Include every row shown'))

    // Only the warning row left the commit; the ready rows are untouched.
    expect(commitButton().textContent).toContain('Import 3 transactions')
  })

  it('excluding a row decrements the count', () => {
    renderStep()

    fireEvent.click(screen.getByLabelText('Include row 1'))
    expect(commitButton().textContent).toContain('Import 3 transactions')
  })

  it('fixing an error row flips it to ready and counts it', () => {
    renderStep()

    expect(screen.getByText(/⛔ 1 errors/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'fix the refund' }))

    expect(
      screen.getByText(/✅ 4 ready · ⚠ 1 warnings · ⛔ 0 errors/),
    ).toBeDefined()
    expect(commitButton().textContent).toContain('Import 5 transactions')
  })

  it('has no duplicate status or toggle: the file imports as it is', () => {
    renderStep()

    expect(screen.queryByText(/duplicate/i)).toBeNull()
    expect(screen.queryByLabelText('Skip duplicates')).toBeNull()
  })

  it('hands the commit exactly the rows the table counted', () => {
    const onCommit = vi.fn()
    renderStep({ onCommit })

    fireEvent.click(commitButton())
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('keeps the row editor, and the edit in it, through a re-scan', () => {
    const harness = (scanning: boolean) => (
      <RescanHarness
        scanning={scanning}
        headers={HEADERS}
        matrix={MATRIX}
        walletGroups={WALLETS}
        walletCurrencies={{ w1: 'SAR' }}
        amend={(draft) => ({ ...draft, aliases: ANSWERED() })}
      />
    )
    const view = render(harness(false))

    fireEvent.click(screen.getByLabelText('Edit row 1'))
    fireEvent.change(screen.getByLabelText(/^Note/), {
      target: { value: 'weekly shop' },
    })
    // The typing itself re-rendered the step with a fresh `defaults` object, which used to
    // be enough on its own to wipe the field.
    expect(screen.getByLabelText(/^Note/)).toHaveProperty(
      'value',
      'weekly shop',
    )

    view.rerender(harness(true))

    // The grid goes while the pass runs; the dialog and what was typed into it do not.
    expect(screen.getByText(/Checking \d+ of 5 rows/)).toBeDefined()
    expect(screen.queryByRole('grid', { hidden: true })).toBeNull()
    expect(screen.getByLabelText(/^Note/)).toHaveProperty(
      'value',
      'weekly shop',
    )
  })

  it('renders a window, not ten thousand rows', () => {
    const matrix = Array.from({ length: 10_000 }, (_unused, index) => [
      '2026-08-01',
      `SHOP ${index}`,
      '-10.00',
      'Main',
      'Groceries',
    ])

    renderStep({ matrix })

    expect(commitButton().textContent).toContain('Import 10,000 transactions')
    expect(screen.getAllByRole('row').length).toBeLessThan(40)
  })
})
