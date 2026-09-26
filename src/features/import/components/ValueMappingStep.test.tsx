// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useStubImport } from '#/features/import/__fixtures__/useStubImport'
import { ValueMappingStep } from './ValueMappingStep'
import type { StubSeed } from '#/features/import/__fixtures__/useStubImport'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'

const HEADERS = ['Date', 'Description', 'Amount', 'Account', 'Category']

const MATRIX = [
  ['01/08/2026', 'CARREFOUR HYPER 4471', '-142.50', 'Main', 'Groceries'],
  ['02/08/2026', 'STC PREPAID', '-89.00', 'Main', 'Groceries'],
  ['04/08/2026', 'ATM WITHDRAWAL', '-500.00', 'MADA CARD 4471', 'Kids school'],
]

const WALLETS = [{ label: null, wallets: [{ id: 'w1', name: 'Main' }] }]

/** The real report: the file names the bank, the app names a wallet inside a group. */
const BILAD_MATRIX = [
  ['01/08/2026', 'CARREFOUR HYPER 4471', '-142.50', 'Al Bilad', 'Groceries'],
  ['02/08/2026', 'STC PREPAID', '-89.00', 'ALBILAD', 'Groceries'],
]

const NO_ACCOUNT_HEADERS = ['Date', 'Description', 'Amount']
const NO_ACCOUNT_MATRIX = [
  ['01/08/2026', 'CARREFOUR HYPER 4471', '-142.50'],
  ['02/08/2026', 'STC PREPAID', '-89.00'],
]

const merchant = (over: Partial<LocalMerchant> = {}): LocalMerchant => ({
  id: 'm1',
  displayName: 'Carrefour',
  learnedCategory: 'groceries',
  learnedSubcategory: 'supermarket',
  learnedType: 'spend',
  timesSeen: 12,
  timesConfirmed: 4,
  lastSeenAt: null,
  autoCategorize: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

const alias = (raw: string): LocalMerchantAlias => ({
  id: `a-${raw}`,
  merchantId: 'm1',
  normalizedKey: raw.toLowerCase(),
  rawSample: raw,
  origin: 'import',
  createdAt: '2026-01-01T00:00:00Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
})

function Harness(seed: StubSeed) {
  const csv = useStubImport(seed)
  return (
    <>
      <ValueMappingStep
        csv={csv}
        draft={csv.draft!}
        onBack={() => undefined}
        onNext={() => undefined}
      />
      <ul data-testid="rows">
        {seed.matrix.map((_cells, index) => {
          const row = csv.rowAt(index)
          return row === null ? null : (
            <li key={index}>
              {`row${index} category=${row.draft?.category ?? '-'} merchant=${
                row.draft?.merchantId ?? '-'
              } note=${row.draft?.note ?? '-'}`}
            </li>
          )
        })}
      </ul>
    </>
  )
}

const renderStep = (seed: Partial<StubSeed> = {}) =>
  render(
    <Harness
      headers={HEADERS}
      matrix={MATRIX}
      walletGroups={WALLETS}
      walletCurrencies={{ w1: 'SAR' }}
      {...seed}
    />,
  )

beforeAll(() => {
  // jsdom implements none of these; the modal chrome and the searchable pickers need them.
  Element.prototype.scrollIntoView = () => undefined
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
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

describe('ValueMappingStep', () => {
  it('fills in what it is sure of and marks it', () => {
    renderStep()

    expect(screen.getByLabelText('What “Main” means')).toHaveProperty(
      'textContent',
      expect.stringContaining('Main'),
    )
    expect(screen.getAllByText('✓ auto').length).toBeGreaterThan(0)
  })

  it('keeps Next disabled and names the account it cannot place', () => {
    renderStep()

    expect(screen.getAllByText('Needs a match').length).toBeGreaterThan(0)
    expect(
      screen.getByText(/Choose an account for “MADA CARD 4471”/),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: /Next: review/ })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('lets the step-② default answer the blocking value', () => {
    renderStep({
      amend: (draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      }),
    })

    expect(screen.getByRole('button', { name: /Next: review/ })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('shows a matched merchant’s other spellings and its learned category', () => {
    renderStep({
      merchantIndex: {
        merchants: [merchant()],
        aliases: [alias('CARREFOUR HYPER 4471'), alias('carrefour jeddah')],
      },
    })

    expect(screen.getByText(/also known as/)).toBeDefined()
    expect(screen.getByText(/usually Groceries/)).toBeDefined()
    expect(
      screen.getByText(/row0 category=groceries merchant=m1/),
    ).toBeDefined()
  })

  it('skipping merchants leaves the description in the note', () => {
    renderStep({
      merchantIndex: {
        merchants: [merchant()],
        aliases: [alias('CARREFOUR HYPER 4471')],
      },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Skip merchants for this import' }),
    )

    expect(
      screen.getByText(/row0 .*merchant=- note=CARREFOUR HYPER 4471/),
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Match merchants again' }),
    ).toBeDefined()
  })

  it('binds the bank a file names when its group holds one account', () => {
    renderStep({
      matrix: BILAD_MATRIX,
      walletGroups: [
        { label: 'Al Bilad', wallets: [{ id: 'w1', name: 'Main' }] },
      ],
    })

    expect(screen.getByLabelText('What “Al Bilad” means')).toHaveProperty(
      'textContent',
      expect.stringContaining('Main'),
    )
    expect(screen.getAllByText('✓ auto').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Next: review/ })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('asks which account when the group it names holds several', () => {
    renderStep({
      matrix: BILAD_MATRIX,
      walletGroups: [
        {
          label: 'Al Bilad',
          wallets: [
            { id: 'w1', name: 'Main' },
            { id: 'w2', name: 'Savings' },
          ],
        },
      ],
      walletCurrencies: { w1: 'SAR', w2: 'SAR' },
    })

    // Both spellings land on the group, and neither is bound to an account for the user.
    expect(
      screen.getAllByText(
        'Matches the group “Al Bilad” — choose which account.',
      ),
    ).toHaveLength(2)
    expect(screen.getAllByText('Choose one')).toHaveLength(2)
    expect(screen.getByText(/Choose an account for/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Next: review/ })).toHaveProperty(
      'disabled',
      true,
    )

    fireEvent.click(screen.getByLabelText('What “Al Bilad” means'))
    fireEvent.click(screen.getByRole('option', { name: 'Savings · SAR' }))

    expect(screen.getByLabelText('What “Al Bilad” means')).toHaveProperty(
      'textContent',
      expect.stringContaining('Savings'),
    )
    expect(screen.getAllByText('Choose one')).toHaveLength(1)
  })

  it('explains a missing account column instead of showing nothing', () => {
    renderStep({ headers: NO_ACCOUNT_HEADERS, matrix: NO_ACCOUNT_MATRIX })

    expect(
      screen.getByText(/No column in this file holds an account/),
    ).toBeDefined()
    expect(screen.getByText(/no fallback account is set/)).toBeDefined()
    expect(screen.queryByText(/nothing to match/)).toBeNull()
  })

  it('names the fallback every row will use when one is set', () => {
    renderStep({
      headers: NO_ACCOUNT_HEADERS,
      matrix: NO_ACCOUNT_MATRIX,
      amend: (draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      }),
    })

    expect(screen.getByText(/every row goes to Main/)).toBeDefined()
  })

  it('files every category it could not place under the default at once', () => {
    // A fallback account, so the row this category sits on is readable rather than blocked.
    renderStep({
      amend: (draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      }),
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Use Other for the rest' }),
    )

    expect(screen.getByText(/row2 category=other/)).toBeDefined()
    expect(
      screen.queryByRole('button', { name: 'Use Other for the rest' }),
    ).toBeNull()
  })

  it('skips the rows of every account it could not place at once', () => {
    renderStep()

    fireEvent.click(
      screen.getByRole('button', { name: 'Skip the unmatched rows' }),
    )

    expect(screen.getByLabelText('What “MADA CARD 4471” means')).toHaveProperty(
      'textContent',
      expect.stringContaining('Skip these rows'),
    )
    expect(screen.getByRole('button', { name: /Next: review/ })).toHaveProperty(
      'disabled',
      false,
    )
    expect(
      screen.queryByRole('button', { name: 'Skip the unmatched rows' }),
    ).toBeNull()
  })

  it('records a wallet to create without touching the database', () => {
    renderStep()

    fireEvent.click(screen.getByLabelText('What “MADA CARD 4471” means'))
    fireEvent.click(screen.getByRole('option', { name: 'Create an account…' }))

    expect(screen.getByLabelText('Name')).toHaveProperty(
      'value',
      'MADA CARD 4471',
    )
    expect(
      screen.getByText(/Balances are worked out from your transactions/),
    ).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))

    expect(screen.getByText(/New account · MADA CARD 4471 · SAR/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Next: review/ })).toHaveProperty(
      'disabled',
      false,
    )
  })
})
