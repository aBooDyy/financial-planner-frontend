import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { LocalBill } from '#/db/types'
import { updateBill } from '#/features/bills/data/mutations'
import { closeRest, reopenPlanned } from '#/features/planned/data/mutations'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { skipOccurrence } from '#/features/planning/actions/payBill'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import {
  CYCLES_PAST,
  CYCLES_UPCOMING,
  billCycles,
  cycleChip,
  cycleDate,
  cycleFigure,
  cycleSub,
  estimateSuggestion,
} from '#/features/planning/view/billCycles'
import type { BillCycle } from '#/features/planning/view/billCycles'
import { money } from '#/features/planning/view/format'
import { convertMinor } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { StatusChip } from '#/features/planning/components/kit/StatusChip'
import { DetailGroup } from './DetailParts'

const PAST_STEP = 12

/** Every due date of a bill: what is overdue, what is coming, and what has been. */
export function BillDates({ bill }: { bill: LocalBill }) {
  const { inputs, today } = usePlannedData()
  const [upcoming, setUpcoming] = useState(CYCLES_UPCOMING)
  const [past, setPast] = useState(CYCLES_PAST)
  const [expanded, setExpanded] = useState<string | null>(null)
  const cycles = useMemo(
    () =>
      billCycles({
        bill,
        planned: inputs.planned,
        txns: inputs.txns,
        setAsides: inputs.setAsides,
        rates: inputs.rates,
        today,
        upcoming,
        past,
        beforeStart: past > CYCLES_PAST,
      }),
    [bill, inputs, today, upcoming, past],
  )
  const suggestion = estimateSuggestion(bill, cycles.past)

  const list = (rows: ReadonlyArray<BillCycle>) => (
    <ul className="flex flex-col gap-[7px]">
      {rows.map((c) => (
        <CycleRow
          key={c.occurrence}
          bill={bill}
          cycle={c}
          expanded={expanded === c.occurrence}
          onToggle={() =>
            setExpanded(expanded === c.occurrence ? null : c.occurrence)
          }
        />
      ))}
    </ul>
  )

  return (
    <div className="flex flex-col gap-4">
      {suggestion !== null ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] bg-fp-transfer-soft px-[13px] py-[11px] text-[12.5px] font-semibold">
          <span className="fp-sensitive min-w-0 flex-1">
            Your last payments averaged {money(suggestion, bill.currency)}. The
            estimate is {money(bill.amount, bill.currency)}.
          </span>
          <button
            type="button"
            onClick={() =>
              void updateBill(bill.id, { amount: suggestion }).then(() =>
                toast('Estimate updated'),
              )
            }
            className="rounded-[9px] bg-fp-surface px-[10px] py-[6px] font-bold text-fp-transfer hover:brightness-95"
          >
            Use it
          </button>
        </div>
      ) : null}
      {cycles.due.length > 0 ? (
        <DetailGroup title={`Overdue · ${cycles.due.length}`}>
          {list(cycles.due)}
        </DetailGroup>
      ) : null}
      {cycles.upcoming.length > 0 ? (
        <DetailGroup title="Coming up">
          {list(cycles.upcoming)}
          {cycles.moreUpcoming ? (
            <MoreButton onClick={() => setUpcoming(upcoming + CYCLES_UPCOMING)}>
              Show later dates
            </MoreButton>
          ) : null}
        </DetailGroup>
      ) : null}
      <DetailGroup title="Past">
        {cycles.past.length > 0 ? (
          list(cycles.past)
        ) : (
          <p className="text-[13px] text-fp-text-3">Nothing yet.</p>
        )}
        {cycles.morePast ? (
          <MoreButton onClick={() => setPast(past + PAST_STEP)}>
            Show earlier dates
          </MoreButton>
        ) : null}
      </DetailGroup>
    </div>
  )
}

function MoreButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-[12.5px] font-bold text-fp-accent-ink hover:underline"
    >
      {children}
    </button>
  )
}

function CycleRow({
  bill,
  cycle,
  expanded,
  onToggle,
}: {
  bill: LocalBill
  cycle: BillCycle
  expanded: boolean
  onToggle: () => void
}) {
  const { today } = usePlannedData()
  const wallets = usePlanningWallets()
  const walletName = (id: string) =>
    wallets.byId.get(id)?.name ?? 'A deleted wallet'
  const chip = cycleChip(cycle)
  const date = cycleDate(cycle.occurrence, today)
  return (
    <li className="rounded-[12px] border border-fp-border">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-[10px] px-3 py-[9px] text-start hover:bg-fp-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold">{date}</span>
          <span className="fp-sensitive block truncate text-[11.5px] text-fp-text-3">
            {cycleSub(cycle, bill, walletName, today)}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-[3px]">
          <span className="fp-sensitive text-[13px] font-bold tabular-nums">
            {cycleFigure(cycle, bill)}
          </span>
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden
          className={cn(
            'flex-none text-fp-text-3 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded ? (
        <div className="flex flex-col gap-[10px] border-t border-fp-border px-3 py-[10px]">
          <CycleEntries bill={bill} cycle={cycle} />
          <CycleActions bill={bill} cycle={cycle} date={date} />
        </div>
      ) : null}
    </li>
  )
}

/** The payments and set-asides behind a due date; each opens where it can be changed. */
function CycleEntries({ bill, cycle }: { bill: LocalBill; cycle: BillCycle }) {
  const { inputs, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const inBill = (a: { amount: number; currency: string }) =>
    convertMinor(a.amount, a.currency, bill.currency, inputs.rates)
  const walletName = (id: string | null) =>
    id ? (wallets.byId.get(id)?.name ?? 'A deleted wallet') : null

  if (cycle.payments.length === 0 && cycle.setAsides.length === 0)
    return (
      <p className="text-[12.5px] text-fp-text-3">
        Nothing paid or set aside for this date yet.
      </p>
    )
  return (
    <ul className="flex flex-col gap-1">
      {cycle.payments.map((t) => (
        <Entry
          key={t.id}
          title={`Paid ${cycleDate(t.date, today)}`}
          sub={walletName(t.walletId) ?? ''}
          amount={`−${money(inBill(t), bill.currency)}`}
          onClick={() => openSheet({ kind: 'payment', transactionId: t.id })}
        />
      ))}
      {cycle.setAsides.map((a) => (
        <Entry
          key={a.id}
          title={`Set aside ${cycleDate(a.date, today)}`}
          sub={
            (walletName(a.walletId) ?? a.externalLabel ?? 'Held outside') +
            (a.releasedById ? ' · used by the payment' : '')
          }
          amount={money(inBill(a), bill.currency)}
          onClick={() => openSheet({ kind: 'setAside', id: a.id })}
        />
      ))}
    </ul>
  )
}

function Entry({
  title,
  sub,
  amount,
  onClick,
}: {
  title: string
  sub: string
  amount: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="-mx-[6px] flex w-[calc(100%+12px)] items-center gap-3 rounded-[8px] px-[6px] py-1 text-start text-[12.5px] hover:bg-fp-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-[11.5px] text-fp-text-3">
            {sub}
          </span>
        </span>
        <span className="fp-sensitive flex-none font-bold tabular-nums">
          {amount}
        </span>
      </button>
    </li>
  )
}

function CycleActions({
  bill,
  cycle,
  date,
}: {
  bill: LocalBill
  cycle: BillCycle
  date: string
}) {
  const openSheet = usePlanningUi((s) => s.openSheet)
  if (bill.closedAt !== null || cycle.state === 'paid') return null
  const pay = () =>
    openSheet({ kind: 'payNow', billId: bill.id, occurrence: cycle.occurrence })
  const open =
    cycle.state === 'overdue' ||
    cycle.state === 'due_today' ||
    cycle.state === 'upcoming'
  const planned = cycle.plannedId
  return (
    <div className="flex flex-wrap gap-[6px]">
      <ActionButton primary onClick={pay}>
        {cycle.paid > 0 ? 'Pay the rest' : 'Pay'}
      </ActionButton>
      {open && cycle.paid === 0 ? (
        <ActionButton
          onClick={() =>
            void skipOccurrence(bill.id, cycle.occurrence).then(() =>
              toast(`${date} skipped`),
            )
          }
        >
          Skip
        </ActionButton>
      ) : null}
      {open && cycle.paid > 0 && planned ? (
        <ActionButton
          onClick={() =>
            void closeRest(planned).then(() => toast(`${date} closed`))
          }
        >
          Close the rest
        </ActionButton>
      ) : null}
      {open ? (
        <ActionButton
          onClick={() =>
            openSheet({
              kind: 'cycleAmount',
              billId: bill.id,
              occurrence: cycle.occurrence,
            })
          }
        >
          Change amount
        </ActionButton>
      ) : null}
      {cycle.state === 'skipped' && planned ? (
        <ActionButton
          onClick={() =>
            void reopenPlanned(planned).then(() => toast('Skip undone'))
          }
        >
          Undo skip
        </ActionButton>
      ) : null}
    </div>
  )
}

function ActionButton({
  primary,
  onClick,
  children,
}: {
  primary?: boolean
  onClick: () => void
  children: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={primary ? 'default' : 'quiet'}
      onClick={onClick}
      className="rounded-[10px] text-[12.5px] font-bold"
    >
      {children}
    </Button>
  )
}
