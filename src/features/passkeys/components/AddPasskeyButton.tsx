import { Plus } from 'lucide-react'
import { ReasonTooltip } from '#/components/ReasonTooltip'
import { Button } from '#/components/ui/button'

type Props = {
  /** Why adding is off right now; null when it can run. */
  reason: string | null
  busy: boolean
  onAdd: () => void
}

export function AddPasskeyButton({ reason, busy, onAdd }: Props) {
  const button = (
    <Button
      type="button"
      disabled={reason !== null || busy}
      onClick={onAdd}
      className="gap-1.5 px-4 py-[9px] text-[13.5px]"
    >
      <Plus size={15} strokeWidth={2.2} />
      {busy ? 'Adding…' : 'Add a passkey'}
    </Button>
  )
  if (reason === null) return button
  return (
    <ReasonTooltip reason={reason}>
      <span
        tabIndex={0}
        aria-label={reason}
        className="inline-flex cursor-not-allowed rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/30"
      >
        {button}
      </span>
    </ReasonTooltip>
  )
}
