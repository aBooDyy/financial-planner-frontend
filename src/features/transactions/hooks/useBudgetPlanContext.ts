import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalBill } from '#/db/types'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { readPayCalendar } from '#/features/transactions/data/payCalendar'

const NO_BILLS: LocalBill[] = []

/** What the budget editor shows beside its period and bills choices; live while it is open. */
export function useBudgetPlanContext(today: string): {
  /** Null while it loads. */
  payCalendar: PayCalendar | null
  bills: LocalBill[]
} {
  const payCalendar = useLiveQuery(() => readPayCalendar(today), [today])
  const bills = useLiveQuery(() => db.bills.toArray())
  return { payCalendar: payCalendar ?? null, bills: bills ?? NO_BILLS }
}
