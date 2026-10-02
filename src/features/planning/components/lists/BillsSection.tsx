import { ReceiptText } from 'lucide-react'
import type { LocalBill } from '#/db/types'
import type { BillStatus } from '#/features/planning/data/status'
import { updateBill } from '#/features/bills/data/mutations'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { billOwner } from '#/features/planned/data/owners'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { useItemActions } from '#/features/planning/hooks/useItemActions'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { dayMonth, money, perPeriod } from '#/features/planning/view/format'
import { billChip, billMeta } from '#/features/planning/view/itemCopy'
import type { RankChange, TierKey } from '#/features/planning/view/reorder'
import { convertMinor } from '#/lib/currency'
import { ProgressBar } from '#/features/planning/components/kit/ProgressBar'
import { DoneCard } from './DoneCard'
import { EmptyPlanCard } from './EmptyPlanCard'
import { ItemRow } from './ItemRow'
import { SectionHeading } from './SectionHeading'
import { TierCard } from './TierCard'
import { useTierDrag } from './useTierDrag'

const TIER_TITLE: Record<TierKey, string> = {
  must: 'Must pay',
  nice: 'Nice to have',
}

async function applyBillRanks(changes: RankChange[]) {
  for (const c of changes)
    await updateBill(c.id, { position: c.position, mustPay: c.tier === 'must' })
}

/** Bills (04 §5): Must pay and Nice to have tiers, drag to reorder, finished ones in Done. */
export function BillsSection() {
  const planning = usePlanning()
  const { inputs } = usePlannedData()
  const wallets = usePlanningWallets()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const openDetail = usePlanningUi((s) => s.openDetail)
  const actions = useItemActions()
  const { calendar } = planning
  const base = inputs.base
  const toBase = (amount: number, currency: string) =>
    convertMinor(amount, currency, base, inputs.rates)

  const statusOf = (b: LocalBill) =>
    planning.bills[b.id] as BillStatus | undefined
  const isOpen = (b: LocalBill) =>
    b.closedAt === null && statusOf(b)?.state !== 'paid'
  const byPosition = (a: LocalBill, b: LocalBill) => a.position - b.position
  const open = inputs.bills.filter(isOpen).sort(byPosition)
  const tiers: Record<TierKey, LocalBill[]> = {
    must: open.filter((b) => b.mustPay),
    nice: open.filter((b) => !b.mustPay),
  }
  const drag = useTierDrag(tiers, applyBillRanks)
  const done = inputs.bills.filter((b) => !isOpen(b))

  const add = () => openSheet({ kind: 'bill', id: null })
  if (planning.loading) return null
  if (inputs.bills.length === 0)
    return (
      <>
        <SectionHeading title="Bills" addLabel="Add bill" onAdd={add} />
        <EmptyPlanCard
          icon={ReceiptText}
          title="No bills yet"
          text="Add rent, subscriptions, insurance — anything you have to pay — and we’ll make sure the money’s there when it’s due."
          addLabel="Add bill"
          onAdd={add}
        />
      </>
    )

  const monthly = open
    .filter((b) => statusOf(b)?.cycle === 'each_paycheck' && b.frequency)
    .reduce(
      (sum, b) =>
        sum +
        (toBase(b.amount, b.currency) * frequencyMetaOf(b, 'monthly').perYear) /
          12,
      0,
    )
  const savingUp = open
    .filter((b) => statusOf(b)?.cycle === 'save_up')
    .reduce(
      (sum, b) => sum + toBase(statusOf(b)?.perPaycheck ?? 0, b.currency),
      0,
    )
  const sub = [
    monthly > 0 ? `${money(monthly, base)} a month` : null,
    savingUp > 0
      ? `${money(savingUp, base)} ${perPeriod(calendar)} saved for bills due later`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const tierNote = (list: LocalBill[]) => {
    const total = list.reduce(
      (sum, b) => sum + toBase(statusOf(b)?.perPaycheck ?? 0, b.currency),
      0,
    )
    return total > 0
      ? `${money(total, base)} ${perPeriod(calendar)}`
      : undefined
  }

  return (
    <>
      <SectionHeading
        title="Bills"
        count={open.length}
        sub={sub}
        addLabel="Add bill"
        onAdd={add}
      />
      {(['must', 'nice'] as const).map((tier) =>
        tiers[tier].length === 0 ? null : (
          <TierCard
            key={tier}
            title={TIER_TITLE[tier]}
            note={tierNote(tiers[tier])}
          >
            {tiers[tier].map((b) => {
              const s = statusOf(b)
              if (!s) return null
              const walletName = b.walletId
                ? (wallets.byId.get(b.walletId)?.name ?? null)
                : null
              return (
                <ItemRow
                  key={b.id}
                  name={b.name}
                  color={b.color}
                  meta={billMeta(b, s, walletName, calendar)}
                  amount={money(b.amount, b.currency)}
                  chip={billChip(s, b.currency, planning.today)}
                  progress={
                    s.cycle === 'save_up' ? (
                      <ProgressBar
                        value={s.setAside}
                        max={s.amount}
                        color="var(--fp-chart-set-aside)"
                        label={`${b.name} set aside`}
                      />
                    ) : undefined
                  }
                  menu={actions.billMenu(b)}
                  onOpen={() => openDetail(billOwner(b.id))}
                  drag={drag.rowProps(b.id, tier)}
                  onGripKey={drag.gripKeys(b.id, tier)}
                />
              )
            })}
          </TierCard>
        ),
      )}
      <DoneCard
        title="Done"
        items={done.map((b) => ({
          id: b.id,
          name: b.name,
          color: b.color,
          note:
            b.closedAt !== null
              ? `Ended ${dayMonth(b.closedAt.slice(0, 10))}`
              : `Paid · ${money(b.amount, b.currency)}`,
          onReopen:
            b.closedAt !== null ? () => void actions.reopen(b, 'bill') : null,
          onOpen: () => openDetail(billOwner(b.id)),
        }))}
      />
    </>
  )
}
