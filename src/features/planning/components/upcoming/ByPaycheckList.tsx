import { CalendarDays } from 'lucide-react'
import { billOwner, goalOwner } from '#/features/planned/data/owners'
import { usePlannedRowActions } from '#/features/planned/hooks/usePlannedRowActions'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type {
  UpcomingPeriod,
  UpcomingRow,
} from '#/features/planning/data/upcoming'
import type { PlanningView } from '#/features/planning/hooks/usePlanning'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { money, signedMoney } from '#/features/planning/view/format'
import {
  confirmedText,
  paymentMeta,
  paymentState,
  periodHead,
  periodSummary,
  setAsideMeta,
  skippedText,
  stillToPay,
} from '#/features/planning/view/upcoming'
import { EmptyPlanCard } from '#/features/planning/components/lists/EmptyPlanCard'
import { NeedsConfirmingBand } from './NeedsConfirmingBand'
import { PeriodCard } from './PeriodCard'
import type { PeriodGroup } from './PeriodCard'
import { UpcomingRowItem } from './UpcomingRowItem'

/** Upcoming by paycheck (04 §5): Needs confirming, then each pay period's rows. */
export function ByPaycheckList({ planning }: { planning: PlanningView }) {
  const { inputs } = usePlannedData()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const openDetail = usePlanningUi((s) => s.openDetail)
  const confirm = (plannedId: string) =>
    openSheet({ kind: 'confirmPlanned', plannedId })
  const actions = usePlannedRowActions(confirm)
  const { upcoming, calendar, today } = planning
  const base = inputs.base

  if (upcoming.isEmpty)
    return (
      <EmptyPlanCard
        icon={CalendarDays}
        title="Nothing coming up yet"
        text="Bills, set-asides and paydays show up here, grouped by the paycheck that covers them."
        addLabel="Plan something"
        onAdd={() => openSheet({ kind: 'chooser' })}
      />
    )

  const billOf = (id: string | null) =>
    id ? inputs.bills.find((b) => b.id === id) : undefined
  const goalOf = (id: string | null) =>
    id ? inputs.goals.find((g) => g.id === id) : undefined
  const open = (row: UpcomingRow) => {
    if (row.item.billId) openDetail(billOwner(row.item.billId))
    else if (row.item.goalId) openDetail(goalOwner(row.item.goalId))
    else confirm(row.id)
  }

  const nameOf = (row: UpcomingRow) =>
    billOf(row.item.billId)?.name ?? goalOf(row.item.goalId)?.name ?? row.name
  const confirmRow = async (row: UpcomingRow) => {
    if (await actions.confirm(row)) toast(confirmedText(row, nameOf(row)))
  }
  const skipRow = async (row: UpcomingRow) => {
    if (await actions.skip(row)) toast(skippedText(nameOf(row)))
  }

  const renderRow = (row: UpcomingRow) => {
    const bill = billOf(row.item.billId)
    const goal = goalOf(row.item.goalId)
    const color =
      row.item.role === 'income'
        ? 'var(--fp-accent)'
        : (bill?.color ?? goal?.color ?? 'var(--fp-text-3)')
    if (row.item.role === 'set_aside')
      return (
        <UpcomingRowItem
          key={row.id}
          row={row}
          name={nameOf(row)}
          color={color}
          meta={setAsideMeta(
            row,
            bill
              ? {
                  kind: 'bill',
                  bill,
                  status: planning.bills[bill.id],
                }
              : goal
                ? {
                    kind: 'goal',
                    goal,
                    status: planning.goals[goal.id],
                  }
                : null,
          )}
          action={{
            label: 'Set aside now',
            busy: actions.busyId === row.id,
            onClick: () => void confirmRow(row),
          }}
          onOpen={() => open(row)}
        />
      )
    if (row.item.role === 'income')
      return (
        <UpcomingRowItem
          key={row.id}
          row={row}
          name={nameOf(row)}
          color={color}
          meta={paymentMeta(row)}
          onOpen={() => open(row)}
        />
      )
    return (
      <UpcomingRowItem
        key={row.id}
        row={row}
        name={nameOf(row)}
        color={color}
        meta={paymentMeta(row)}
        state={paymentState(row, today)}
        autopay={bill?.autopay}
        action={
          bill
            ? {
                label: 'Pay now',
                onClick: () =>
                  openSheet({
                    kind: 'payNow',
                    billId: bill.id,
                    occurrence: row.item.occurrence,
                  }),
              }
            : undefined
        }
        onOpen={() => open(row)}
      />
    )
  }

  const groupsOf = (p: UpcomingPeriod): PeriodGroup[] =>
    p.kind === 'this'
      ? [
          {
            title: 'Due',
            rows: [...p.income, ...p.payments, ...p.setAsides].map(renderRow),
          },
        ]
      : [
          { title: 'Paycheck', rows: p.income.map(renderRow) },
          { title: 'Bills due', rows: p.payments.map(renderRow) },
          { title: 'Set aside for later', rows: p.setAsides.map(renderRow) },
        ]

  return (
    <>
      <NeedsConfirmingBand
        rows={upcoming.due}
        nameOf={nameOf}
        busyId={actions.busyId}
        onOpen={open}
        onConfirm={(r) => void confirmRow(r)}
        onSkip={(r) => void skipRow(r)}
      />
      {upcoming.periods.map((p) =>
        p.rows.length === 0 && p.kind !== 'this' ? null : (
          <PeriodCard
            key={p.period.start}
            head={periodHead(p, calendar, today, base)}
            groups={groupsOf(p)}
            summary={p.kind === 'later' ? periodSummary(p, base) : undefined}
            footer={
              p.kind === 'this'
                ? {
                    label:
                      calendar.kind === 'paycheck'
                        ? 'Still to pay before payday'
                        : 'Still to pay this month',
                    value: money(stillToPay(p, base, inputs.rates), base),
                  }
                : {
                    label: 'Left for spending',
                    value: signedMoney(p.left, base),
                    tone: p.left < 0 ? 'danger' : 'ok',
                  }
            }
          />
        ),
      )}
    </>
  )
}
