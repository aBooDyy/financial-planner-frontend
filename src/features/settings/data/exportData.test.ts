// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalTransaction } from '#/db/types'
import type * as CurrencyModule from '#/lib/currency'

vi.mock('#/lib/currency', async (importOriginal) => {
  const actual = await importOriginal<typeof CurrencyModule>()
  // The real precision table arrives from `GET /config`, which no unit test boots.
  return { ...actual, decimalsFor: (code: string) => (code === 'JPY' ? 0 : 2) }
})

const { exportCsv } = await import('./exportData')

const tx = (over: Partial<LocalTransaction> = {}): LocalTransaction => ({
  id: 'tx-1',
  type: 'spend',
  amount: 1234,
  currency: 'SAR',
  category: 'groceries',
  subcategory: null,
  walletId: 'w-1',
  goalId: null,
  merchantId: null,
  date: '2026-01-05',
  note: null,
  source: null,
  transferId: null,
  plannedId: null,
  createdAt: '2026-01-05T00:00:00.000Z',
  updatedAt: '2026-01-05T00:00:00.000Z',
  version: 'v1',
  dirty: 0,
  deleted: 0,
  ...over,
})

/** Runs the export and returns the CSV the download was handed. */
const exported = async (): Promise<string[]> => {
  const captured: Blob[] = []
  const create = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation((value: Blob | MediaSource) => {
      captured.push(value as Blob)
      return 'blob:means'
    })
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
  try {
    await exportCsv()
  } finally {
    create.mockRestore()
    revoke.mockRestore()
    click.mockRestore()
  }
  const blob = captured.at(-1)
  if (!blob) throw new Error('export produced no file')
  return (await blob.text()).split('\n')
}

beforeEach(async () => {
  await db.transactions.clear()
  await db.balanceNodes.clear()
  await db.categories.clear()
})

describe('exportCsv', () => {
  it('writes the amount in major units under an `amount` header', async () => {
    await db.transactions.add(tx({ amount: 1234, currency: 'SAR' }))

    const [header, first] = await exported()

    expect(header.split(',')[2]).toBe('amount')
    expect(first.split(',')[2]).toBe('12.34')
  })

  it('scales by the currency, so a zero-decimal one is not divided', async () => {
    await db.transactions.add(tx({ amount: 500, currency: 'JPY' }))

    const [, first] = await exported()

    expect(first.split(',')[2]).toBe('500')
  })

  it('names an adjustment plainly and signs it by direction', async () => {
    await db.transactions.bulkAdd([
      tx({ id: 'a', type: 'adjustment_in', category: null, amount: 1000 }),
      tx({ id: 'b', type: 'adjustment_out', category: null, amount: 250 }),
    ])

    const rows = (await exported()).slice(1).map((line) => line.split(','))

    expect(rows.map((cells) => [cells[1], cells[2]])).toEqual(
      expect.arrayContaining([
        ['balance adjustment', '10'],
        ['balance adjustment', '-2.5'],
      ]),
    )
  })
})
