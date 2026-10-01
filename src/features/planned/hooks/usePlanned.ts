import { useMemo } from 'react'
import {
  closeRest,
  confirmPlanned,
  editPlannedAmount,
  movePlanned,
  reopenPlanned,
  skipPlanned,
} from '#/features/planned/data/mutations'
import { buildPlannedList } from '#/features/planned/data/views'
import type { PlannedListView } from '#/features/planned/data/views'
import { usePlannedData } from './usePlannedData'

export type UsePlanned = PlannedListView & {
  loading: boolean
  confirm: typeof confirmPlanned
  skip: typeof skipPlanned
  closeRest: typeof closeRest
  move: typeof movePlanned
  editAmount: typeof editPlannedAmount
  reopen: typeof reopenPlanned
}

/**
 * The Planned tab: what needs confirming, the next 14 days, and later — with the actions a
 * row offers. Reads the local DB only; every action is a local-first write.
 */
export function usePlanned(): UsePlanned {
  const data = usePlannedData()
  const list = useMemo(
    () =>
      buildPlannedList({
        planned: data.inputs.planned,
        nodes: data.nodes,
        index: data.state.index,
        rates: data.inputs.rates,
        base: data.inputs.base,
        today: data.today,
      }),
    [data.inputs, data.state, data.nodes, data.today],
  )
  return {
    loading: data.loading,
    ...list,
    confirm: confirmPlanned,
    skip: skipPlanned,
    closeRest,
    move: movePlanned,
    editAmount: editPlannedAmount,
    reopen: reopenPlanned,
  }
}
