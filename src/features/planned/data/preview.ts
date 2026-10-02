/**
 * What confirming would do, before it is done — the confirm dialog's live effect line
 * ("Umrah trip goes to SR 5,500 of 13,000 and is back on the SR 1,500/mo plan",
 * "Main Checking goes to SR 24,310"). Pure: it re-derives the planner's state with the
 * settlement added, so the preview is the number the plan will show afterwards.
 */
import type {
  LocalBalanceNode,
  LocalPlanned,
  LocalSetAside,
  LocalTransaction,
} from '#/db/types'
import { walletLiveBalances } from '#/features/transactions/data/ledger'
import { convertMinor } from '#/lib/currency'
import { isoOf } from './dates'
import { settledOf } from './settle'
import { fitPlanFrom } from './fit'
import { goalOwner } from './owners'
import { derivePlannerState } from './state'
import type { PlannerInputs, PlannerState } from './state'

export type ConfirmPreview = {
  /** `empty`: nothing entered; `partial`: some stays open; `over`: more than planned. */
  kind: 'empty' | 'full' | 'partial' | 'over'
  /** In the item's currency. */
  leftOpen: number
  excess: number
  goal: {
    id: string
    name: string
    savedAfter: number
    target: number
    /** The live monthly plan once this lands. */
    liveAmountAfter: number
    /** The stored plan's monthly amount, for "back on the SR 1,500/mo plan". */
    storedAmount: number | null
  } | null
  wallet: { id: string; balanceAfter: number } | null
}

const PREVIEW_ID = 'preview'

export function previewConfirm(args: {
  inputs: PlannerInputs
  state: PlannerState
  nodes: ReadonlyArray<LocalBalanceNode>
  userId: string
  today: Date
  item: LocalPlanned
  /** In the item's currency. */
  amount: number
  walletId: string | null
  /** Every transaction on `walletId`; the wallet line waits while it is undefined. */
  walletTxns: ReadonlyArray<LocalTransaction> | undefined
  date: string
}): ConfirmPreview {
  const { inputs, state, item, amount, walletId, date } = args
  const settled = settledOf(item, state.index, inputs.rates)
  const remainder = Math.max(0, item.amount - settled)
  const kind =
    amount <= 0
      ? 'empty'
      : amount < remainder
        ? 'partial'
        : amount > remainder
          ? 'over'
          : 'full'
  const wallet = walletId
    ? args.nodes.find((n) => n.id === walletId && n.kind === 'wallet')
    : undefined
  const walletCurrency = wallet?.currency ?? item.currency
  const inWallet = convertMinor(
    amount,
    item.currency,
    walletCurrency,
    inputs.rates,
  )

  const extraTxns: LocalTransaction[] = []
  const extraSetAsides: LocalSetAside[] = []
  if (amount > 0 && item.role === 'set_aside' && (item.goalId || item.billId)) {
    extraSetAsides.push({
      id: PREVIEW_ID,
      goalId: item.goalId,
      billId: item.goalId ? null : item.billId,
      occurrence: item.goalId ? null : item.occurrence,
      source: wallet ? 'wallet' : 'outside',
      walletId: wallet ? wallet.id : null,
      externalLabel: wallet ? null : 'preview',
      amount: wallet ? inWallet : amount,
      currency: wallet ? walletCurrency : item.currency,
      note: null,
      position: 0,
      date,
      plannedId: item.id,
      releasedAt: null,
      releasedById: null,
      movedByTransferId: null,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    })
  } else if (amount > 0 && wallet) {
    extraTxns.push({
      id: PREVIEW_ID,
      type: item.role === 'income' ? 'income' : 'spend',
      amount: inWallet,
      currency: walletCurrency,
      categoryId: item.categoryId,
      walletId: wallet.id,
      goalId: item.billId ? null : item.goalId,
      billId: item.billId,
      merchantId: null,
      date,
      note: null,
      source: null,
      transferId: null,
      plannedId: item.id,
      createdAt: '',
      updatedAt: '',
      version: '',
      dirty: 0,
      deleted: 0,
    })
  }

  const goal = item.goalId
    ? inputs.goals.find((g) => g.id === item.goalId)
    : undefined
  let goalPreview: ConfirmPreview['goal'] = null
  if (goal) {
    const after = derivePlannerState(
      {
        ...inputs,
        txns: [...inputs.txns, ...extraTxns],
        setAsides: [...inputs.setAsides, ...extraSetAsides],
      },
      args.userId,
      args.today,
    )
    goalPreview = {
      id: goal.id,
      name: goal.name,
      savedAfter: after.progress[goal.id]?.progress ?? 0,
      target: goal.target ?? 0,
      liveAmountAfter: fitPlanFrom(
        goalOwner(goal.id),
        after.desired,
        inputs.planned,
        after.index,
        inputs.rates,
        isoOf(args.today),
      ).header.amount,
      storedAmount: goal.planAmount,
    }
  }

  const walletPreview =
    wallet && extraTxns.length > 0 && args.walletTxns
      ? {
          id: wallet.id,
          balanceAfter:
            walletLiveBalances(
              [wallet],
              [...args.walletTxns, ...extraTxns],
              inputs.rates,
            )[wallet.id] ?? 0,
        }
      : null

  return {
    kind,
    leftOpen: Math.max(0, remainder - amount),
    excess: Math.max(0, amount - remainder),
    goal: goalPreview,
    wallet: walletPreview,
  }
}
