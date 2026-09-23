import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/db'
import type { OutboxEntry } from '#/db/types'
import type {
  CreateTransferWire,
  Transaction,
  UpdateTransferWire,
} from '#/features/transactions/api/types'
import { ApiError } from '#/lib/apiError'

const schedulePush = vi.fn()
vi.mock('#/db/sync', () => ({ schedulePush: () => schedulePush() }))

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
}))
vi.mock('#/features/transactions/api/transactionsApi', () => ({
  transfersApi: { create: api.create, update: api.update, remove: api.remove },
  transactionsApi: { list: api.list },
  budgetsApi: {},
  recurringsApi: {},
}))

const { createTransfer, deleteTransfer, updateTransfer } =
  await import('./transfers')
const { pushTransferEntry } = await import('./transferSync')

const draft = {
  fromWalletId: 'w1',
  toWalletId: 'w2',
  amount: 80_000,
  fromCurrency: 'SAR',
  toAmount: 80_000,
  toCurrency: 'SAR',
  date: '2026-09-23',
  note: 'ATM withdrawal',
}

const legsOf = (transferId: string) =>
  db.transactions.where('transferId').equals(transferId).sortBy('type')

const queued = () => db.outbox.toArray()

const serverLeg = (
  over: Partial<Transaction> & Pick<Transaction, 'id' | 'type'>,
): Transaction => ({
  amount: 80_000,
  currency: 'SAR',
  category: null,
  subcategory: null,
  walletId: 'w1',
  goalId: null,
  merchantId: null,
  date: '2026-09-23',
  note: 'ATM withdrawal',
  source: null,
  transferId: null,
  createdAt: 'c',
  updatedAt: 'u',
  version: 'server-v1',
  ...over,
})

/** Answers a create or update with the legs as the server would store them. */
const echoLegs = async (transferId: string) => {
  const legs = await legsOf(transferId)
  return {
    transferId,
    legs: legs.map((l) =>
      serverLeg({ ...l, version: `${l.id}-v2`, transferId }),
    ),
  }
}

const drain = async () => {
  for (const entry of await queued()) await pushTransferEntry(entry)
}

beforeEach(async () => {
  schedulePush.mockClear()
  for (const fn of Object.values(api)) fn.mockReset()
  await Promise.all([db.transactions.clear(), db.outbox.clear()])
})

describe('createTransfer', () => {
  it('writes both legs and one outbox entry in one go', async () => {
    const transferId = await createTransfer(draft)

    const [inLeg, outLeg] = await legsOf(transferId)
    expect(outLeg).toMatchObject({
      type: 'transfer_out',
      walletId: 'w1',
      amount: 80_000,
      category: null,
      dirty: 1,
    })
    expect(inLeg).toMatchObject({ type: 'transfer_in', walletId: 'w2' })

    const [entry] = await queued()
    expect(entry).toMatchObject({
      op: 'create',
      entity: 'transfer',
      id: transferId,
    })
    expect(entry.payload).toEqual({
      id: transferId,
      out_id: outLeg.id,
      in_id: inLeg.id,
      from_wallet_id: 'w1',
      to_wallet_id: 'w2',
      amount: 80_000,
      to_amount: null,
      date: '2026-09-23',
      note: 'ATM withdrawal',
    } satisfies CreateTransferWire)
    expect(schedulePush).toHaveBeenCalledTimes(1)
  })

  it('sends what arrives only across currencies', async () => {
    const transferId = await createTransfer({
      ...draft,
      toCurrency: 'USD',
      toAmount: 21_333,
    })
    const [entry] = await queued()
    expect((entry.payload as CreateTransferWire).to_amount).toBe(21_333)
    const [inLeg] = await legsOf(transferId)
    expect(inLeg).toMatchObject({ currency: 'USD', amount: 21_333 })
  })
})

describe('updateTransfer', () => {
  it('folds an edit into a create that has not left yet', async () => {
    const transferId = await createTransfer(draft)
    await updateTransfer(transferId, {
      ...draft,
      amount: 5_000,
      toAmount: 5_000,
    })

    const entries = await queued()
    expect(entries).toHaveLength(1)
    expect(entries[0].op).toBe('create')
    expect((entries[0].payload as CreateTransferWire).amount).toBe(5_000)
    const legs = await legsOf(transferId)
    expect(legs.map((l) => l.amount)).toEqual([5_000, 5_000])
  })

  it('queues one update carrying both legs’ versions once synced', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await drain()
    expect(await queued()).toHaveLength(0)

    await updateTransfer(transferId, {
      ...draft,
      fromWalletId: 'w2',
      toWalletId: 'w1',
    })
    const [inLeg, outLeg] = await legsOf(transferId)
    expect(outLeg.walletId).toBe('w2')
    expect(inLeg.walletId).toBe('w1')
    const [entry] = await queued()
    expect(entry.op).toBe('update')
    expect(entry.payload).toMatchObject({
      from_wallet_id: 'w2',
      to_wallet_id: 'w1',
      out_version: `${outLeg.id}-v2`,
      in_version: `${inLeg.id}-v2`,
    } satisfies Partial<UpdateTransferWire>)
  })
})

describe('a transfer whose other account was deleted', () => {
  it('updates the surviving leg and sends nulls for the missing side', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await drain()
    const [inLeg] = await legsOf(transferId)
    await db.transactions.delete(inLeg.id)

    await updateTransfer(transferId, {
      ...draft,
      amount: 1_000,
      toWalletId: '',
    })
    const [outLeg] = await legsOf(transferId)
    expect(outLeg).toMatchObject({ type: 'transfer_out', amount: 1_000 })
    const [entry] = await queued()
    expect(entry.payload).toEqual({
      from_wallet_id: 'w1',
      to_wallet_id: null,
      amount: 1_000,
      to_amount: null,
      date: '2026-09-23',
      note: 'ATM withdrawal',
      out_version: `${outLeg.id}-v2`,
      in_version: null,
    } satisfies UpdateTransferWire)
  })
})

describe('deleteTransfer', () => {
  it('drops a never-synced transfer without telling the server', async () => {
    const transferId = await createTransfer(draft)
    await deleteTransfer(transferId)
    expect(await legsOf(transferId)).toHaveLength(0)
    expect(await queued()).toHaveLength(0)
  })

  it('removes both legs and queues one delete once synced', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await drain()

    await deleteTransfer(transferId)
    expect(await legsOf(transferId)).toHaveLength(0)
    const entries = await queued()
    expect(entries).toEqual([
      expect.objectContaining({
        op: 'delete',
        entity: 'transfer',
        id: transferId,
      }),
    ])
  })
})

describe('pushTransferEntry', () => {
  const entryFor = async (): Promise<OutboxEntry> => (await queued())[0]

  it('stores the server legs and clears the entry on create', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await pushTransferEntry(await entryFor())
    const legs = await legsOf(transferId)
    expect(legs.every((l) => l.dirty === 0 && l.version.endsWith('-v2'))).toBe(
      true,
    )
    expect(await queued()).toHaveLength(0)
  })

  it('settles a taken id from the server instead of retrying it', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'spending.transfer.id_taken',
        message: 'taken',
      }),
    )
    api.list.mockResolvedValue([])
    await pushTransferEntry(await entryFor())
    expect(api.update).not.toHaveBeenCalled()
    expect(await queued()).toHaveLength(0)
    expect(await legsOf(transferId)).toHaveLength(0)
  })

  it('keeps the entry queued on a network failure', async () => {
    await createTransfer(draft)
    api.create.mockRejectedValue(
      new ApiError({ status: 0, code: 'common.network', message: 'offline' }),
    )
    await expect(pushTransferEntry(await entryFor())).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(await queued()).toHaveLength(1)
  })

  it('drops the legs when the server no longer has the transfer', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await drain()
    await updateTransfer(transferId, { ...draft, note: 'edited' })
    api.update.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'spending.transfer.not_found',
        message: 'gone',
      }),
    )
    await pushTransferEntry(await entryFor())
    expect(await legsOf(transferId)).toHaveLength(0)
    expect(await queued()).toHaveLength(0)
  })

  it('re-sends an edit on the server’s versions after a conflict', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await drain()
    await updateTransfer(transferId, { ...draft, note: 'mine' })
    const [inLeg, outLeg] = await legsOf(transferId)

    api.update
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: 'common.conflict',
          message: 'stale',
        }),
      )
      .mockImplementationOnce(() => echoLegs(transferId))
    api.list.mockResolvedValue([
      serverLeg({ ...outLeg, transferId, version: 'out-v9', note: 'theirs' }),
      serverLeg({ ...inLeg, transferId, version: 'in-v9', note: 'theirs' }),
    ])
    await pushTransferEntry(await entryFor())

    const retried = api.update.mock.calls[1][1] as UpdateTransferWire
    expect(retried).toMatchObject({
      note: 'mine',
      out_version: 'out-v9',
      in_version: 'in-v9',
    })
    expect(await queued()).toHaveLength(0)
  })

  it('treats a 404 on delete as already done', async () => {
    const transferId = await createTransfer(draft)
    api.create.mockImplementation(() => echoLegs(transferId))
    await drain()
    await deleteTransfer(transferId)
    api.remove.mockRejectedValue(
      new ApiError({
        status: 404,
        code: 'spending.transfer.not_found',
        message: 'gone',
      }),
    )
    await pushTransferEntry(await entryFor())
    expect(await queued()).toHaveLength(0)
  })
})
