import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { buildBillsYear } from '#/features/planning/data/billsYear'
import type { BillsYear } from '#/features/planning/data/billsYear'

/** What bills cost over the coming year; `null` while the plan loads. */
export function useBillsYear(): BillsYear | null {
  const { loading, inputs, today } = usePlannedData()
  return useMemo(
    () => (loading ? null : buildBillsYear(inputs, today)),
    [loading, inputs, today],
  )
}
