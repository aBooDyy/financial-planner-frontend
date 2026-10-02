import { reopenBill } from '#/features/bills/data/actions'
import {
  pauseGoal,
  reopenGoal,
  resumeGoal,
} from '#/features/goals/data/actions'
import type { LocalBill, LocalGoal } from '#/db/types'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import type { MenuAction } from '#/features/planning/components/kit/ItemMenu'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'

/**
 * Every anytime action on a bill or goal (02, D23), for a row's ⋯ menu and the detail panel:
 * the money ones open their sheet, reopen / pause / resume act at once.
 */
export function useItemActions() {
  const openSheet = usePlanningUi((s) => s.openSheet)

  const reopen = async (item: LocalBill | LocalGoal, kind: 'bill' | 'goal') => {
    if (kind === 'bill') await reopenBill(item.id)
    else await reopenGoal(item.id)
    toast(`${item.name} reopened`)
  }

  const billMenu = (bill: LocalBill): MenuAction[] =>
    bill.closedAt !== null
      ? [
          { label: 'Reopen', onSelect: () => void reopen(bill, 'bill') },
          {
            label: 'Delete',
            destructive: true,
            onSelect: () =>
              openSheet({
                kind: 'delete',
                target: { kind: 'bill', id: bill.id },
              }),
          },
        ]
      : [
          {
            label: 'Edit',
            onSelect: () => openSheet({ kind: 'bill', id: bill.id }),
          },
          {
            label: 'Add money',
            onSelect: () =>
              openSheet({ kind: 'addMoney', owner: billOwner(bill.id) }),
          },
          {
            label: 'Pay now',
            onSelect: () => openSheet({ kind: 'payNow', billId: bill.id }),
          },
          {
            label: bill.frequency === null ? 'Mark as paid' : 'End this bill',
            onSelect: () =>
              openSheet({ kind: 'markDone', owner: billOwner(bill.id) }),
          },
          {
            label: 'Delete',
            destructive: true,
            onSelect: () =>
              openSheet({
                kind: 'delete',
                target: { kind: 'bill', id: bill.id },
              }),
          },
        ]

  const goalMenu = (goal: LocalGoal): MenuAction[] =>
    goal.closedAt !== null
      ? [
          { label: 'Reopen', onSelect: () => void reopen(goal, 'goal') },
          {
            label: 'Delete',
            destructive: true,
            onSelect: () =>
              openSheet({
                kind: 'delete',
                target: { kind: 'goal', id: goal.id },
              }),
          },
        ]
      : [
          {
            label: 'Edit',
            onSelect: () => openSheet({ kind: 'goal', id: goal.id }),
          },
          {
            label: 'Add money',
            onSelect: () =>
              openSheet({ kind: 'addMoney', owner: goalOwner(goal.id) }),
          },
          {
            label: 'Use it',
            onSelect: () => openSheet({ kind: 'useIt', goalId: goal.id }),
          },
          {
            label: 'Mark as done',
            onSelect: () =>
              openSheet({ kind: 'markDone', owner: goalOwner(goal.id) }),
          },
          goal.pausedAt !== null
            ? {
                label: 'Resume',
                onSelect: () =>
                  void resumeGoal(goal.id).then(() =>
                    toast(`${goal.name} resumed`),
                  ),
              }
            : {
                label: 'Pause',
                onSelect: () =>
                  void pauseGoal(goal.id).then(() =>
                    toast(`${goal.name} paused`),
                  ),
              },
          {
            label: 'Delete',
            destructive: true,
            onSelect: () =>
              openSheet({
                kind: 'delete',
                target: { kind: 'goal', id: goal.id },
              }),
          },
        ]

  return { billMenu, goalMenu, reopen }
}
