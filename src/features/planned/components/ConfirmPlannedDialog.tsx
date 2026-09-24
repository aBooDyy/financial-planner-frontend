import type { JSX } from 'react'
import { useConfirmForm } from '#/features/planned/hooks/useConfirmForm'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { Button } from '#/components/ui/button'
import { ConfirmPlannedFields } from './ConfirmPlannedFields'
import { ConfirmPlannedSecondary } from './ConfirmPlannedSecondary'

type Props = {
  plannedId: string | null
  onOpenChange: (open: boolean) => void
}

/**
 * Confirm a planned item (1d): amount (the open remainder), wallet, date, the live effect
 * line, and the secondary actions — move the date, skip it, or close a partial's rest.
 * Open while `plannedId` is set.
 */
export function ConfirmPlannedDialog({
  plannedId,
  onOpenChange,
}: Props): JSX.Element {
  const f = useConfirmForm(plannedId, () => onOpenChange(false))
  const open = plannedId !== null

  const footer = (
    <div className="flex w-full flex-col gap-[10px]">
      <Button
        type="button"
        onClick={f.confirm}
        disabled={!f.canConfirm}
        className="w-full rounded-[11px] py-[11px]"
      >
        {f.primaryLabel || 'Confirm'}
      </Button>
      <ConfirmPlannedSecondary f={f} />
    </div>
  )

  // The design puts "Planned for Sep 1 · 23 days ago" above the name.
  const title = (
    <span className="flex flex-col gap-[2px]">
      {f.headerLine ? (
        <span className="text-[12px] font-semibold tracking-normal text-fp-text-3">
          {f.headerLine}
        </span>
      ) : null}
      <span>{f.item?.name ?? 'Planned item'}</span>
    </span>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={f.ready ? footer : undefined}
    >
      {f.ready ? (
        <div className="flex flex-col gap-[15px]">
          <ConfirmPlannedFields f={f} />
        </div>
      ) : (
        <p className="py-6 text-center text-[13px] text-fp-text-3">
          {f.item === null && open ? 'Loading…' : null}
        </p>
      )}
    </ResponsiveDialog>
  )
}
