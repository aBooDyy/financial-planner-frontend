import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { resolveLeftover } from '#/features/planning/actions/leftover'
import type { LeftoverChoice } from '#/features/planning/actions/leftover'
import type { LeftoverReport } from '#/features/planning/data/leftover'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { toast } from '#/features/planning/stores/toast'
import { money } from '#/features/planning/view/format'
import { Dot } from '#/features/planning/components/kit/Spine'

type Props = {
  report: LeftoverReport
  payingWalletId: string
  date: string
  onClose: () => void
}

/**
 * After a payment, money this occurrence still holds in other wallets (03 §5): move it to the
 * paying wallet (a real transfer), free it up, or keep it for the next one. Never silent.
 */
export function LeftoverSheet({
  report,
  payingWalletId,
  date,
  onClose,
}: Props) {
  const { inputs } = usePlannedData()
  const wallets = usePlanningWallets()
  const [busy, setBusy] = useState<LeftoverChoice | null>(null)
  const bill = inputs.bills.find((b) => b.id === report.billId)
  const currency = bill?.currency ?? wallets.base
  const paying = wallets.byId.get(payingWalletId)?.name ?? 'the paying wallet'
  const placeOf = (walletId: string | null, label: string | null) =>
    walletId
      ? (wallets.byId.get(walletId)?.name ?? 'A deleted wallet')
      : (label ?? 'Outside your wallets')
  const places = report.lines.map((l) => placeOf(l.walletId, l.externalLabel))
  const canMove = report.lines.some(
    (l) => l.walletId !== null && l.walletId !== payingWalletId,
  )
  const total = money(report.total, currency)

  const choose = async (choice: LeftoverChoice) => {
    setBusy(choice)
    try {
      await resolveLeftover(report, choice, { payingWalletId, date })
      toast(
        choice === 'move'
          ? `${total} moved to ${paying}`
          : choice === 'free'
            ? `${total} is free to spend`
            : 'Kept for next time',
      )
      onClose()
    } finally {
      setBusy(null)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && busy === null) onClose()
      }}
      title="Some money is left over"
      description={`You still have ${total} set aside for ${bill?.name ?? 'this bill'} in ${places.join(' and ')}.`}
      contentClassName="sm:max-w-[480px]"
    >
      <div className="flex flex-col gap-[6px] rounded-[14px] bg-fp-surface-2 px-[14px] py-3">
        {report.lines.map((l, i) => (
          <div key={i} className="flex items-center gap-[9px] text-[13.5px]">
            <Dot
              color={
                l.walletId
                  ? (wallets.byId.get(l.walletId)?.color ?? 'var(--fp-text-3)')
                  : 'var(--fp-text-3)'
              }
            />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {places[i]}
            </span>
            <span className="font-extrabold text-fp-transfer tabular-nums">
              {money(l.amount, l.currency)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {canMove ? (
          <Button
            type="button"
            size="dialog"
            disabled={busy !== null}
            onClick={() => void choose('move')}
          >
            Move it to {paying}
          </Button>
        ) : null}
        <Button
          type="button"
          size="dialog"
          variant={canMove ? 'quiet' : 'default'}
          disabled={busy !== null}
          onClick={() => void choose('free')}
        >
          Free it up
        </Button>
        {report.canKeep && report.nextOccurrence ? (
          <Button
            type="button"
            size="dialog"
            variant="quiet"
            disabled={busy !== null}
            onClick={() => void choose('keep')}
          >
            Keep it for next time
          </Button>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
