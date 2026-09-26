import { useCallback, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalPlanned, LocalTransaction } from '#/db/types'
import { confirmPlanned } from '#/features/planned/data/mutations'
import type {
  ConfirmInput,
  ConfirmResult,
} from '#/features/planned/data/mutations'
import { previewConfirm } from '#/features/planned/data/preview'
import type { ConfirmPreview } from '#/features/planned/data/preview'
import { settledOf } from '#/features/planned/data/settle'
import { usePlannedData } from './usePlannedData'

export type UseConfirmPlanned = {
  item: LocalPlanned | null
  settled: number
  /** What is still open — the dialog's prefilled amount. */
  remainder: number
  /** The dialog's starting values: the open remainder, the suggested wallet, today. */
  defaults: { amount: number; walletId: string | null; date: string }
  /** The live effect line for an entered amount and date, into the hook's wallet. */
  preview: (amount: number, date?: string) => ConfirmPreview | null
  confirm: (input: ConfirmInput) => Promise<ConfirmResult>
}

const NO_TXNS: LocalTransaction[] = []

/**
 * State for the confirm dialog (1d) of one planned item, confirming into `walletId` (null:
 * external or none). Only that wallet's ledger is read, for its "goes to X" balance.
 */
export function useConfirmPlanned(
  id: string | null,
  walletId: string | null,
): UseConfirmPlanned {
  const data = usePlannedData()
  const ledger = useLiveQuery(
    async () => ({
      walletId,
      rows: walletId
        ? await db.transactions.where('walletId').equals(walletId).toArray()
        : NO_TXNS,
    }),
    [walletId],
  )
  // Until the new wallet's read lands, the last result is the previous wallet's ledger.
  const walletTxns = ledger?.walletId === walletId ? ledger.rows : undefined
  const item = useMemo(
    () => (id ? (data.inputs.planned.find((p) => p.id === id) ?? null) : null),
    [id, data.inputs],
  )
  const settled = item
    ? settledOf(item, data.state.index, data.inputs.rates)
    : 0
  const remainder = item ? Math.max(0, item.amount - settled) : 0

  const preview = useCallback(
    (amount: number, date = data.today) =>
      item
        ? previewConfirm({
            inputs: data.inputs,
            state: data.state,
            nodes: data.nodes,
            userId: data.userId,
            today: data.todayDate,
            item,
            amount,
            walletId,
            walletTxns,
            date,
          })
        : null,
    // `todayDate` is keyed by its day.
    [
      item,
      walletId,
      walletTxns,
      data.inputs,
      data.state,
      data.nodes,
      data.userId,
      data.today,
    ],
  )
  const confirm = useCallback(
    (input: ConfirmInput) =>
      item
        ? confirmPlanned(item.id, input)
        : Promise.reject(new Error('planned.not_found')),
    [item],
  )

  return {
    item,
    settled,
    remainder,
    defaults: {
      amount: remainder,
      walletId: item?.walletId ?? null,
      date: data.today,
    },
    preview,
    confirm,
  }
}
