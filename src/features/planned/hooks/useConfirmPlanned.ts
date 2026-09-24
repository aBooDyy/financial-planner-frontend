import { useCallback, useMemo } from 'react'
import type { LocalPlanned } from '#/db/types'
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
  /** The live effect line for an entered amount / wallet / date. */
  preview: (
    amount: number,
    walletId: string | null,
    date?: string,
  ) => ConfirmPreview | null
  confirm: (input: ConfirmInput) => Promise<ConfirmResult>
}

/** State for the confirm dialog (1d) of one planned item. */
export function useConfirmPlanned(id: string | null): UseConfirmPlanned {
  const data = usePlannedData()
  const item = useMemo(
    () => (id ? (data.inputs.planned.find((p) => p.id === id) ?? null) : null),
    [id, data.inputs],
  )
  const settled = item
    ? settledOf(item, data.state.index, data.inputs.rates)
    : 0
  const remainder = item ? Math.max(0, item.amount - settled) : 0

  const preview = useCallback(
    (amount: number, walletId: string | null, date = data.today) =>
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
            date,
          })
        : null,
    // `todayDate` is keyed by its day.
    [item, data.inputs, data.state, data.nodes, data.userId, data.today],
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
