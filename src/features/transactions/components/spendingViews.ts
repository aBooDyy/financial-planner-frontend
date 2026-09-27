import { CalendarClock, Gauge, ReceiptText, Repeat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SpendingView } from '#/features/transactions/constants'

/** How each Spending tab is named and drawn in the tab card and the mobile sub-nav. */
export const SPENDING_VIEW_META: Record<
  SpendingView,
  { label: string; icon: LucideIcon }
> = {
  activity: { label: 'Activity', icon: ReceiptText },
  planned: { label: 'Planned', icon: CalendarClock },
  budgets: { label: 'Budgets', icon: Gauge },
  recurring: { label: 'Recurring', icon: Repeat },
}
