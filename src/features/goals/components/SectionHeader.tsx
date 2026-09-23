import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Props = {
  title: string
  sub: string
  actionLabel?: string
  onAction?: () => void
}

export function SectionHeader({ title, sub, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[19px] font-extrabold tracking-[-0.02em]">
          {title}
        </div>
        <div className="mt-[2px] text-[12.5px] text-fp-text-3 tabular-nums">
          {sub}
        </div>
      </div>
      {actionLabel && onAction ? (
        <Button
          onClick={onAction}
          className="gap-[6px] rounded-[11px] px-[14px] py-[9px] text-[13px] font-bold shadow-[0_4px_12px_-4px_var(--fp-accent)]"
        >
          <Plus size={15} strokeWidth={2.2} />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
