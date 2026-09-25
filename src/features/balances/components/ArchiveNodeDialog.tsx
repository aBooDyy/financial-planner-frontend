import { Archive } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { ArchiveTarget } from '#/features/balances/data/archivedList'

type Props = {
  target: ArchiveTarget | null
  onClose: () => void
  onConfirm: () => void
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function consequences(t: ArchiveTarget): string[] {
  const lines = [
    'It leaves Balances, your totals and every account picker.',
    'Its transactions stay in your history, untouched.',
  ]
  if (t.walletCount > 0)
    lines.push(
      `The ${plural(t.walletCount, 'wallet')} inside ${t.walletCount === 1 ? 'goes' : 'go'} with it.`,
    )
  if (t.holdingStr)
    lines.push(`${t.holdingStr} stops counting toward your total.`)
  return lines
}

/** Archiving is reversible, so the confirm spells out what changes rather than warning. */
export function ArchiveNodeDialog({ target, onClose, onConfirm }: Props) {
  return (
    <ResponsiveDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={target ? `Archive “${target.name}”?` : ''}
      contentClassName="sm:max-w-[420px]"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button autoFocus onClick={onConfirm} className="gap-[6px]">
            <Archive size={15} strokeWidth={2} />
            Archive {target?.kind ?? ''}
          </Button>
        </>
      }
    >
      {target ? (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-[7px] ps-[18px] text-[13px] leading-relaxed text-fp-text-2 [&>li]:list-disc">
            {consequences(target).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="rounded-[11px] bg-fp-surface-2 px-3 py-[9px] text-[12.5px] text-fp-text-2">
            Restore it anytime from{' '}
            <span className="font-semibold text-fp-text">
              Settings › Archived
            </span>
            .
          </p>
        </div>
      ) : null}
    </ResponsiveDialog>
  )
}
