import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Props = {
  icon: LucideIcon
  title: string
  text: string
  addLabel: string
  onAdd: () => void
  /** Under the button, e.g. the emergency fund suggestion. */
  extra?: ReactNode
}

/** A list section with nothing in it yet: a dashed card that says what goes here. */
export function EmptyPlanCard({
  icon: Icon,
  title,
  text,
  addLabel,
  onAdd,
  extra,
}: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] border-[1.5px] border-dashed border-fp-border-strong px-6 py-[34px] text-center">
      <span
        aria-hidden
        className="flex size-[46px] items-center justify-center rounded-[14px] bg-fp-accent-soft text-fp-accent-ink"
      >
        <Icon size={22} strokeWidth={2} />
      </span>
      <div>
        <p className="text-[15px] font-extrabold text-fp-text">{title}</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-[13px] leading-[1.5] text-fp-text-2">
          {text}
        </p>
      </div>
      <Button type="button" onClick={onAdd} className="rounded-[11px] px-4">
        <Plus size={15} strokeWidth={2.4} />
        {addLabel}
      </Button>
      {extra}
    </div>
  )
}
