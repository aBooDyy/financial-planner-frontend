import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { CAPS_LABEL, PANE_BUTTON, PANE_CARD } from './styles'

type Props = {
  rank: number
  total: number
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
}

/** The goal's rank with its move buttons; a move is saved at once, not with the editor. */
export function PriorityControl({
  rank,
  total,
  canUp,
  canDown,
  onUp,
  onDown,
}: Props) {
  return (
    <div role="group" aria-label="Priority" className={PANE_CARD}>
      <div className="flex items-center gap-[10px]">
        <div className="min-w-0 flex-1">
          <div className={CAPS_LABEL}>Priority</div>
          <div className="text-[17px] font-extrabold text-fp-text">
            #{rank} of {total}
          </div>
        </div>
        <Button
          variant="quiet"
          disabled={!canUp}
          onClick={onUp}
          className={`${PANE_BUTTON} gap-[6px]`}
        >
          <ArrowUp size={14} strokeWidth={2.2} />
          Up
        </Button>
        <Button
          variant="quiet"
          disabled={!canDown}
          onClick={onDown}
          className={`${PANE_BUTTON} gap-[6px]`}
        >
          <ArrowDown size={14} strokeWidth={2.2} />
          Down
        </Button>
      </div>
      <p className="-mt-1 text-[12px] leading-[1.45] text-fp-text-3">
        <b className="font-bold text-fp-text-2">Applies right away.</b> Whatever
        is due soonest is funded first; priority decides between items due
        around the same time.
      </p>
    </div>
  )
}
