import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Props = {
  title: string
  sub: string
  /** Omitted when the write can't be taken back from here. */
  onUndo?: () => void
  onDone: () => void
}

/**
 * A create dialog once its write has landed: what changed, with a way back. Render it as the
 * dialog's body with the header hidden (`hideHeader`).
 */
export function DoneState({ title, sub, onUndo, onDone }: Props) {
  return (
    <div className="flex flex-col items-center px-1 pt-[30px] pb-1 text-center">
      <div className="flex size-[52px] items-center justify-center rounded-full bg-fp-accent-soft text-fp-accent-ink">
        <Check size={26} strokeWidth={2.4} />
      </div>
      <div className="mt-[14px] text-[18px] font-extrabold text-fp-text">
        {title}
      </div>
      <div className="mt-1 text-[13.5px] text-fp-text-2">{sub}</div>
      <div className="mt-5 flex w-full gap-2">
        {onUndo ? (
          <Button
            variant="quiet"
            size="dialog"
            onClick={onUndo}
            className="flex-1"
          >
            Undo
          </Button>
        ) : null}
        <Button size="dialog" onClick={onDone} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  )
}
