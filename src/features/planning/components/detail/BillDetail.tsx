import { useMemo } from 'react'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { billOwner } from '#/features/planned/data/owners'
import { useBillPlan } from '#/features/planned/hooks/useBillPlan'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { BillStatus } from '#/features/planning/data/status'
import { useItemActions } from '#/features/planning/hooks/useItemActions'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { dueDay, money, perPeriod } from '#/features/planning/view/format'
import { historyOf } from '#/features/planning/view/history'
import { billChip } from '#/features/planning/view/itemCopy'
import { billPlanText } from '#/features/planning/view/planText'
import { repeatLabel } from '#/features/planning/view/repeat'
import { DetailFrame } from './DetailFrame'
import {
  DetailActions,
  DetailHero,
  HeldIn,
  HistoryList,
  NextOccurrences,
} from './DetailParts'
import type { DetailAction } from './DetailParts'
import { PlanBox } from './PlanBox'

/** A bill's detail (04 §6): this occurrence, where its money is held, its plan, what is next. */
export function BillDetail({
  billId,
  onClose,
}: {
  billId: string
  onClose: () => void
}) {
  const { inputs } = usePlannedData()
  const planning = usePlanning()
  const wallets = usePlanningWallets()
  const catalog = useCategoryCatalog()
  const actions = useItemActions()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const plan = useBillPlan(billId)
  const bill = inputs.bills.find((b) => b.id === billId)
  const status = planning.bills[billId] as BillStatus | undefined
  const walletName = (id: string | null) =>
    id ? (wallets.byId.get(id)?.name ?? 'A deleted wallet') : 'No wallet'
  const history = useMemo(
    () =>
      bill
        ? historyOf({
            kind: 'bill',
            id: bill.id,
            currency: bill.currency,
            txns: inputs.txns,
            setAsides: inputs.setAsides,
            planned: inputs.planned,
            walletName,
            categoryName: () => null,
            rates: inputs.rates,
          })
        : [],
    // `walletName` reads `wallets`, which is in the list.
    [bill, inputs, wallets],
  )

  if (!bill || !status) return null
  const c = bill.currency
  const closed = bill.closedAt !== null
  const saveUp = status.cycle === 'save_up'
  const paidFrom = bill.walletId ? walletName(bill.walletId) : null

  const buttons: DetailAction[] = closed
    ? [
        {
          label: 'Reopen',
          primary: true,
          onClick: () => void actions.reopen(bill, 'bill'),
        },
        {
          label: 'Edit',
          onClick: () => openSheet({ kind: 'bill', id: bill.id }),
        },
      ]
    : [
        {
          label: 'Pay now',
          primary: true,
          onClick: () => openSheet({ kind: 'payNow', billId: bill.id }),
        },
        {
          label: 'Add money',
          onClick: () =>
            openSheet({ kind: 'addMoney', owner: billOwner(bill.id) }),
        },
        {
          label: 'Edit',
          onClick: () => openSheet({ kind: 'bill', id: bill.id }),
        },
      ]

  return (
    <DetailFrame
      color={bill.color}
      title={bill.name}
      sub={[
        repeatLabel(bill),
        catalog.labelOf(bill.categoryId),
        bill.mustPay ? 'Must pay' : 'Nice to have',
      ].join(' · ')}
      menu={actions.billMenu(bill)}
      onClose={onClose}
    >
      <DetailHero
        label={saveUp ? 'Set aside so far' : 'Next payment'}
        value={
          saveUp
            ? `${money(status.setAside, c)} of ${money(status.amount, c)}`
            : money(status.amount, c)
        }
        progress={
          saveUp
            ? {
                value: status.setAside,
                max: status.amount,
                color: 'var(--fp-chart-set-aside)',
              }
            : undefined
        }
        note={
          status.occurrence
            ? saveUp && status.perPaycheck > 0
              ? `${money(status.perPaycheck, c)} ${perPeriod(planning.calendar)} · due ${dueDay(status.occurrence, planning.today)}`
              : `Due ${dueDay(status.occurrence, planning.today)}${paidFrom ? ` · ${paidFrom}` : ''}`
            : 'Nothing left to pay'
        }
        chip={billChip(status, c, planning.today)}
      />
      <DetailActions actions={buttons} />
      <HeldIn lines={status.heldIn} currency={c} wallets={wallets} />
      <PlanBox
        text={billPlanText(
          bill,
          status,
          walletName(bill.saveWalletId ?? bill.walletId),
          planning.calendar,
          planning.today,
        )}
        plan={closed ? null : plan.plan}
        currency={c}
        calendar={planning.calendar}
        lastRecalc={plan.lastRecalc}
        onRecalc={plan.recalc}
        onDismiss={plan.dismissRecalc}
      />
      {bill.frequency !== null && !closed ? (
        <NextOccurrences next={status.next} currency={c} />
      ) : null}
      <HistoryList lines={history} />
    </DetailFrame>
  )
}
