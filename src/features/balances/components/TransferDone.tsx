import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Props = {
  title: string
  sub: string
  onUndo: () => void
  onDone: () => void
}

/** The dialog after a transfer lands: what moved, with a way back. */
export function TransferDone({ title, sub, onUndo, onDone }: Props) {
  return (
    <div className="flex flex-col items-center px-[6px] pt-[18px] pb-[6px] text-center">
      <div className="flex size-[52px] items-center justify-center rounded-full bg-fp-accent-soft text-fp-accent-ink">
        <Check size={26} strokeWidth={2.4} />
      </div>
      <div className="mt-[14px] text-[18px] font-extrabold text-fp-text">
        {title}
      </div>
      <div className="mt-1 text-[13.5px] text-fp-text-2">{sub}</div>
      <div className="mt-5 flex w-full gap-2">
        <Button
          variant="outline"
          onClick={onUndo}
          className="flex-1 rounded-[12px] p-3 text-[14px] font-bold"
        >
          Undo
        </Button>
        <Button
          onClick={onDone}
          className="flex-1 rounded-[12px] p-3 text-[14px] font-bold text-white"
        >
          Done
        </Button>
      </div>
    </div>
  )
}
