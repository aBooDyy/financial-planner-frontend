import { useState } from 'react'
import type { RecalcResult } from '#/features/planned/data/runner'
import type { PlanCompare } from '#/features/planned/data/views'
import type { Behind } from '#/features/planned/data/settle'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { toast } from '#/features/planning/stores/toast'
import { money } from '#/features/planning/view/format'
import { planDrift } from '#/features/planning/view/planText'
import { DetailGroup } from './DetailParts'

type Props = {
  text: string
  /** The stored plan against today's; null while it loads or for a finished item. */
  plan: (PlanCompare & { behind: Pick<Behind, 'behind'> }) | null
  currency: string
  calendar: PayCalendar
  lastRecalc: RecalcResult | null
  onRecalc: () => Promise<RecalcResult | null>
  onDismiss: () => void
}

/**
 * PLAN: what the plan does, how it compares with today's numbers (04 §6) — Recalculate
 * rewrites it to today's, and Undo restores what it was.
 */
export function PlanBox({
  text,
  plan,
  currency,
  calendar,
  lastRecalc,
  onRecalc,
  onDismiss,
}: Props) {
  const [busy, setBusy] = useState(false)
  const behind = plan?.behind.behind ?? 0

  const recalc = async () => {
    setBusy(true)
    try {
      await onRecalc()
      toast('Plan updated')
    } finally {
      setBusy(false)
    }
  }
  const undo = async () => {
    if (!lastRecalc) return
    setBusy(true)
    try {
      await lastRecalc.undo()
      onDismiss()
      toast('Plan restored')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DetailGroup title="Plan">
      <div className="flex flex-col gap-2 rounded-[14px] bg-fp-transfer-soft px-[13px] py-[11px] text-[13.5px] leading-[1.45] font-semibold">
        <p className="fp-sensitive">{text}</p>
        {behind > 0.5 ? (
          <p className="fp-sensitive text-[12.5px] text-fp-warn">
            {money(behind, currency)} behind plan.
          </p>
        ) : behind < -0.5 ? (
          <p className="fp-sensitive text-[12.5px] text-fp-accent-ink">
            {money(-behind, currency)} ahead of plan.
          </p>
        ) : null}
        {plan?.isOffPlan && plan.stored ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-fp-transfer/20 pt-2 text-[12.5px] font-medium text-fp-text-2">
            <span className="fp-sensitive min-w-0 flex-1">
              {planDrift(
                plan.stored.amount,
                plan.live.amount,
                currency,
                calendar,
              )}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void recalc()}
              className="rounded-[9px] bg-fp-surface px-[10px] py-[6px] text-[12.5px] font-bold text-fp-transfer hover:brightness-95 disabled:opacity-50"
            >
              Recalculate
            </button>
          </div>
        ) : null}
        {lastRecalc ? (
          <div className="flex items-center gap-2 border-t border-fp-transfer/20 pt-2 text-[12.5px] font-medium text-fp-text-2">
            <span className="min-w-0 flex-1">Plan updated.</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void undo()}
              className="font-bold text-fp-transfer hover:underline disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </DetailGroup>
  )
}
