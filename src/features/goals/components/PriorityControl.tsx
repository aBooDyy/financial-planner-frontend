import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { FIELD_LABEL } from './styles'

type Props = {
  rank: number
  total: number
  canUp: boolean
  canDown: boolean
  onUp: () => void
  onDown: () => void
}

const MOVE =
  'h-[34px] flex-1 gap-1 rounded-[9px] bg-fp-surface-2 text-[12px] font-bold'

export function PriorityControl({
  rank,
  total,
  canUp,
  canDown,
  onUp,
  onDown,
}: Props) {
  return (
    <div>
      <div className={FIELD_LABEL}>
        Priority #{rank} of {total}
      </div>
      <div className="flex gap-[7px]">
        <Button
          variant="outline"
          disabled={!canUp}
          onClick={onUp}
          className={MOVE}
        >
          <ArrowUp size={14} strokeWidth={2.2} />
          Move up
        </Button>
        <Button
          variant="outline"
          disabled={!canDown}
          onClick={onDown}
          className={MOVE}
        >
          <ArrowDown size={14} strokeWidth={2.2} />
          Move down
        </Button>
      </div>
      <div className="mt-[6px] text-[11px] leading-[1.45] text-fp-text-3">
        Whatever is due soonest is funded first; priority decides between items
        due around the same time.
      </div>
    </div>
  )
}
