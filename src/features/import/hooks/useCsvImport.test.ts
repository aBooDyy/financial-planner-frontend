// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { LocalBalanceNode } from '#/db/types'
import type { CsvReadResult } from '#/features/import/data/csv/read'
import { useCsvImport } from './useCsvImport'

const READ: CsvReadResult = {
  dialect: {
    delimiter: ',',
    quote: '"',
    encoding: 'utf-8',
    decimal: '.',
    skipRows: 0,
    hasHeader: true,
  },
  headers: ['Date', 'Description', 'Debit', 'Credit'],
  rows: [
    ['2026-08-01', 'CARREFOUR HYPER', '142.50', ''],
    ['2026-08-02', 'SALARY', '', '8400.00'],
  ],
  rowCount: 2,
  columnCount: 4,
}

const parseCsvFile = vi.fn()

vi.mock('#/features/import/data/csv/workerClient', () => ({
  parseCsvFile: (...args: unknown[]) => parseCsvFile(...args),
}))

const wallet: LocalBalanceNode = {
  id: 'w1',
  kind: 'wallet',
  parentId: null,
  name: 'Main',
  color: '#000',
  icon: null,
  note: null,
  position: 0,
  collapsed: false,
  archivedAt: null,
  amount: 0,
  currency: 'SAR',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  version: '1',
  dirty: 0,
  deleted: 0,
}

const aFile = () => new File(['date,description'], 'alrajhi.csv')

const openedWizard = async () => {
  const wizard = renderHook(() => useCsvImport())
  await act(async () => {
    wizard.result.current.actions.openFile(aFile())
  })
  await waitFor(() => expect(wizard.result.current.file).not.toBeNull())
  return wizard
}

describe('useCsvImport', () => {
  beforeEach(async () => {
    parseCsvFile.mockReset()
    parseCsvFile.mockResolvedValue(READ)
    await db.balanceNodes.clear()
    await db.transactions.clear()
    await db.balanceNodes.put(wallet)
  })

  it('reads a file and proposes a mapping for it', async () => {
    const { result } = await openedWizard()

    expect(result.current.file?.name).toBe('alrajhi.csv')
    expect(result.current.read.status).toBe('ready')
    expect(result.current.draft?.roles).toEqual([
      'date',
      'merchant',
      'amountOut',
      'amountIn',
    ])
    expect(result.current.suggestedRoles).toEqual(result.current.draft?.roles)
    expect(result.current.mapping).not.toBeNull()
  })

  it('reads a row through the mapping once an account is resolvable', async () => {
    const { result } = await openedWizard()

    // No account is resolvable yet, so every row carries the blocking issue.
    expect(result.current.rowAt(0)?.draft).toBeNull()

    act(() => {
      result.current.actions.updateMapping((draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      }))
    })

    await waitFor(() => expect(result.current.rowAt(0)?.draft).not.toBeNull())
    expect(result.current.rowAt(0)?.draft?.amount).toBe(14250)
    expect(result.current.rowAt(1)?.draft?.type).toBe('income')
  })

  it('re-reads every row when the amount unit changes', async () => {
    const { result } = await openedWizard()
    act(() => {
      result.current.actions.updateMapping((draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      }))
    })
    await waitFor(() =>
      expect(result.current.rowAt(0)?.draft?.amount).toBe(14250),
    )

    act(() => {
      result.current.actions.updateMapping((draft) => ({
        ...draft,
        amountUnit: 'minor',
      }))
    })

    await waitFor(() =>
      expect(result.current.rowAt(0)?.draft?.amount).toBe(143),
    )
  })

  it('answers the whole file only once review asks', async () => {
    const { result } = await openedWizard()
    act(() => {
      result.current.actions.updateMapping((draft) => ({
        ...draft,
        defaults: { ...draft.defaults, walletId: 'w1' },
      }))
    })

    // Step ① holds no pass at all: nothing has asked a whole-file question yet.
    expect(result.current.scan.result).toBeNull()

    act(() => result.current.actions.goTo('review'))

    await waitFor(() => expect(result.current.scan.result).not.toBeNull())
    expect(result.current.scan.result?.counts).toMatchObject({
      total: 2,
      error: 0,
    })
    expect([...result.current.scan.result!.order]).toEqual([0, 1])
  })

  it('walks forward one step at a time and never past the furthest reached', async () => {
    const { result } = await openedWizard()

    expect(result.current.step).toBe('file')
    expect(result.current.canGoTo('columns')).toBe(false)

    act(() => result.current.actions.next())
    expect(result.current.step).toBe('columns')
    expect(result.current.canGoTo('file')).toBe(true)
    expect(result.current.canGoTo('values')).toBe(false)

    act(() => result.current.actions.next())
    expect(result.current.step).toBe('values')

    act(() => result.current.actions.back())
    expect(result.current.step).toBe('columns')
    // Already reached, so the rail can jump forward again.
    expect(result.current.canGoTo('values')).toBe(true)
  })

  it('keeps the previous reading when an adjustment cannot be read', async () => {
    const { result } = await openedWizard()
    parseCsvFile.mockRejectedValueOnce(new Error('nope'))

    act(() => result.current.actions.setDialect({ delimiter: ';' }))

    await waitFor(() => expect(result.current.read.status).toBe('failed'))
    expect(result.current.file?.headers).toEqual(READ.headers)
  })

  it('forgets everything on reset', async () => {
    const { result } = await openedWizard()
    act(() => result.current.actions.next())
    act(() => result.current.actions.reset())

    expect(result.current.step).toBe('file')
    expect(result.current.file).toBeNull()
    expect(result.current.draft).toBeNull()
    expect(result.current.rowAt(0)).toBeNull()
    expect(result.current.scan.result).toBeNull()
  })
})
