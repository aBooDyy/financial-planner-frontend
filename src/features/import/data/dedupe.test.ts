import { describe, expect, it } from 'vitest'
import { testContext, testMapping } from './__fixtures__/mapping'
import { loadFixture } from './csv/__fixtures__/fixtures'
import { readCsv } from './csv/read'
import { buildRows } from './csv/rows'
import { DEFAULT_DEDUPE } from './types'
import {
  buildDedupeIndex,
  emptyDedupeIndex,
  emptySeen,
  fingerprintOf,
  markRow,
  referenceFromNote,
  toLedgerEntry,
  stripReference,
  withDuplicate,
  withReference,
} from './dedupe'
import type { DedupeIndex, LedgerTransaction } from './dedupe'
import type { DedupeSettings, Mapping, ParsedRow } from './types'

const LIMITS = { maxRows: 50_000, maxBytes: 10 * 1024 * 1024 }
const WINDOW: DedupeSettings = { strategy: 'fingerprint', windowDays: 3 }

const MESSY_MAPPING = testMapping({
  roles: ['date', 'merchant', 'amount', 'wallet'],
  aliases: {
    ...testMapping().aliases,
    wallets: { current: { kind: 'wallet', walletId: 'w1' } },
  },
})

const messyRows = (mapping: Mapping = MESSY_MAPPING): ParsedRow[] =>
  buildRows(
    readCsv(loadFixture('messy.csv').bytes, { limits: LIMITS }).rows,
    mapping,
    testContext(),
  )

/** The pass the scan runs per row, over an array: one `seen` shared by all of them. */
const markAll = (
  rows: ReadonlyArray<ParsedRow>,
  ledger: DedupeIndex,
  settings: DedupeSettings,
): ParsedRow[] => {
  const seen = emptySeen()
  return rows.map((row) =>
    withDuplicate(row, markRow(row, ledger, seen, settings) ?? undefined),
  )
}

/** What the rows would look like in the ledger after a commit. */
const asLedger = (rows: ReadonlyArray<ParsedRow>): LedgerTransaction[] =>
  rows
    .filter((row) => row.draft !== null && !row.excluded)
    .map((row, index) => ({
      id: `t${index}`,
      ...row.draft!,
      note: row.draft!.note,
    }))
    .map((row) => ({ ...row, merchantId: row.merchantId ?? null }))

describe('the reference suffix', () => {
  it('round-trips through the note', () => {
    const note = withReference('CARREFOUR', 'TXN8841003')
    expect(note).toBe('CARREFOUR · ref:TXN8841003')
    expect(referenceFromNote(note)).toBe('TXN8841003')
    expect(stripReference(note)).toBe('CARREFOUR')
  })

  it('stands alone when the row has no narrative', () => {
    const note = withReference(null, 'TXN8841003')
    expect(note).toBe('ref:TXN8841003')
    expect(referenceFromNote(note)).toBe('TXN8841003')
    expect(stripReference(note)).toBeNull()
  })

  it('leaves a note with no reference alone', () => {
    expect(withReference('CARREFOUR', null)).toBe('CARREFOUR')
    expect(referenceFromNote('CARREFOUR')).toBeNull()
  })
})

describe('fingerprintOf', () => {
  const base = {
    date: '2026-06-16',
    type: 'spend' as const,
    amount: 4215,
    currency: 'GBP',
    walletId: 'w1',
    merchantId: null,
    note: 'TESCO STORES 3411',
  }

  it('reads the same for the same row spelled two ways', () => {
    expect(fingerprintOf({ ...base, note: 'Tesco  stores, 3411' })).toBe(
      fingerprintOf(base),
    )
  })

  it('prefers a bound merchant over the text, so spellings stop mattering', () => {
    expect(fingerprintOf({ ...base, merchantId: 'm1' })).toBe(
      fingerprintOf({
        ...base,
        merchantId: 'm1',
        note: 'CARREFOUR HYPER 4471',
      }),
    )
  })

  it('ignores a reference the note happens to carry', () => {
    expect(fingerprintOf({ ...base, note: 'TESCO STORES 3411 · ref:X1' })).toBe(
      fingerprintOf(base),
    )
  })

  it('separates rows that differ in anything that matters', () => {
    const keys = new Set([
      fingerprintOf(base),
      fingerprintOf({ ...base, amount: 4216 }),
      fingerprintOf({ ...base, walletId: 'w2' }),
      fingerprintOf({ ...base, type: 'income' }),
      fingerprintOf({ ...base, currency: 'USD' }),
      fingerprintOf({ ...base, date: '2026-06-17' }),
      fingerprintOf({ ...base, note: 'SAINSBURYS' }),
    ])
    expect(keys.size).toBe(7)
  })
})

describe('markRow — against the ledger', () => {
  const ledgerRow = (
    overrides: Partial<LedgerTransaction> = {},
  ): LedgerTransaction => ({
    id: 'existing',
    date: '2026-06-18',
    type: 'spend',
    amount: 450,
    currency: 'SAR',
    walletId: 'w1',
    merchantId: null,
    note: 'DUPLICATE COFFEE',
    ...overrides,
  })

  const coffee = () =>
    messyRows().filter((row) => row.raw[1] === 'DUPLICATE COFFEE')

  it('flags an exact repeat and excludes it by default', () => {
    const [row] = markAll(
      coffee().slice(0, 1),
      buildDedupeIndex([ledgerRow()]),
      WINDOW,
    )
    expect(row.duplicateOf).toBe('existing')
    expect(row.excluded).toBe(true)
    // Never hidden: the draft survives so review can put it back.
    expect(row.draft).not.toBeNull()
  })

  it('matches a bank that posted two days late', () => {
    const [row] = markAll(
      coffee().slice(0, 1),
      buildDedupeIndex([ledgerRow({ date: '2026-06-20' })]),
      WINDOW,
    )
    expect(row.duplicateOf).toBe('existing')
  })

  it('does not match five days out', () => {
    const [row] = markAll(
      coffee().slice(0, 1),
      buildDedupeIndex([ledgerRow({ date: '2026-06-23' })]),
      WINDOW,
    )
    expect(row.duplicateOf).toBeNull()
    expect(row.excluded).toBe(false)
  })

  it('does not match a different amount, wallet or counterparty', () => {
    const others = [
      ledgerRow({ id: 'a', amount: 451 }),
      ledgerRow({ id: 'b', walletId: 'w2' }),
      ledgerRow({ id: 'c', note: 'SOMETHING ELSE' }),
      ledgerRow({ id: 'd', type: 'income' }),
    ]
    const [row] = markAll(
      coffee().slice(0, 1),
      buildDedupeIndex(others),
      WINDOW,
    )
    expect(row.duplicateOf).toBeNull()
  })

  it('finds nothing when dedupe is off', () => {
    const [row] = markAll(
      coffee().slice(0, 1),
      buildDedupeIndex([ledgerRow()]),
      { strategy: 'off', windowDays: 3 },
    )
    expect(row.duplicateOf).toBeNull()
  })
})

describe('markRow — inside the file', () => {
  it('keeps the first of a planted pair and flags the second, with no other false positives', () => {
    const rows = markAll(messyRows(), emptyDedupeIndex(), WINDOW)
    const flagged = rows.filter((row) => row.duplicateOfIndex !== null)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].raw[1]).toBe('DUPLICATE COFFEE')
    expect(flagged[0].duplicateOfIndex).toBe(2)
    expect(rows[2].duplicateOfIndex).toBeNull()
    expect(rows[2].excluded).toBe(false)
  })

  it('leaves unreadable rows out of the pass entirely', () => {
    const rows = markAll(messyRows(), emptyDedupeIndex(), WINDOW)
    const unreadable = rows.filter((row) => row.draft === null)
    expect(unreadable.length).toBeGreaterThan(0)
    expect(unreadable.every((row) => row.duplicateOfIndex === null)).toBe(true)
  })

  it('flags every row when the same file is imported twice', () => {
    const first = markAll(messyRows(), emptyDedupeIndex(), WINDOW)
    const ledger = buildDedupeIndex(asLedger(first))
    const second = markAll(messyRows(), ledger, WINDOW)
    const committable = second.filter((row) => row.draft !== null)
    expect(committable.every((row) => row.duplicateOf !== null)).toBe(true)
  })
})

describe('markRow — by reference', () => {
  const REFERENCED = testMapping({
    dateFormat: 'DD/MM/YYYY',
    roles: ['date', 'merchant', 'amount', 'type', 'reference'],
    amount: { kind: 'typed', column: 2, typeColumn: 3 },
  })
  const referencedRows = (): ParsedRow[] =>
    buildRows(
      readCsv(loadFixture('typed-column.csv').bytes, { limits: LIMITS }).rows,
      REFERENCED,
      testContext({ today: '2026-06-30' }),
    )

  const settings: DedupeSettings = { strategy: 'reference', windowDays: 3 }

  it('matches on the reference alone, whatever else changed', () => {
    const rows = referencedRows()
    const ledger = buildDedupeIndex([
      {
        id: 'existing',
        date: '2026-01-01',
        type: 'income',
        amount: 1,
        currency: 'SAR',
        walletId: 'w9',
        merchantId: null,
        note: 'ANYTHING · ref:TXN8841003',
      },
    ])
    const marked = markAll(rows, ledger, settings)
    expect(marked[0].reference).toBe('TXN8841003')
    expect(marked[0].duplicateOf).toBe('existing')
    expect(marked[1].duplicateOf).toBeNull()
  })

  it('falls back to the fingerprint for a row with no reference', () => {
    const rows = referencedRows().map((row, index) =>
      index === 0 ? { ...row, reference: null } : row,
    )
    const ledger = buildDedupeIndex(
      asLedger([rows[0]]).map((row) => ({ ...row, id: 'existing' })),
    )
    expect(markAll(rows, ledger, settings)[0].duplicateOf).toBe('existing')
  })
})

describe('movements in the ledger index', () => {
  const leg = (type: 'transfer_out' | 'transfer_in', walletId: string) =>
    toLedgerEntry({
      id: `${type}-${walletId}`,
      date: '2026-09-09',
      type,
      amount: 30000,
      currency: 'SAR',
      walletId,
      merchantId: null,
      note: 'Send to STC Pay',
    })

  it('files a leg by its direction on its own wallet', () => {
    expect(leg('transfer_out', 'w1')).toMatchObject({
      type: 'spend',
      movement: true,
    })
    expect(leg('transfer_in', 'w2')).toMatchObject({ type: 'income' })
  })

  it('matches a re-imported transfer side whatever its own note says', () => {
    const index = buildDedupeIndex([leg('transfer_in', 'w2')])
    const draft = {
      date: '2026-09-10',
      type: 'income' as const,
      amount: 30000,
      currency: 'SAR',
      walletId: 'w2',
      note: 'Received from Albilad Bank',
    }
    const row = {
      ...buildRows(
        [['2026-09-10', 'x', '300']],
        testMapping(),
        testContext(),
      )[0],
      reference: null,
    }
    const movement = {
      ...row,
      fingerprint: fingerprintOf({ ...draft, movement: true }),
    }
    const cashflow = { ...row, fingerprint: fingerprintOf(draft) }
    expect(markRow(movement, index, emptySeen(), DEFAULT_DEDUPE)).toEqual({
      ledgerId: 'transfer_in-w2',
      earlierIndex: null,
    })
    expect(markRow(cashflow, index, emptySeen(), DEFAULT_DEDUPE)).toBeNull()
  })
})
