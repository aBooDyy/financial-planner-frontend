import { Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'

type Props = {
  icon: LucideIcon
  title: string
  text?: ReactNode
  action?: { label: string; onClick: () => void; disabled?: boolean }
  // `sm` sits inside a side card or sub-list; `md` fills a list or section on its own.
  size?: 'sm' | 'md'
  // Draws its own card; leave off when the empty state sits inside an existing one.
  framed?: boolean
  children?: ReactNode
}

const SIZES = {
  sm: {
    box: 'gap-2 px-4 py-5',
    tile: 'size-9 rounded-[11px]',
    icon: 17,
    title: 'text-[13.5px]',
    text: 'text-[12.5px]',
  },
  md: {
    box: 'gap-3 px-6 py-9',
    tile: 'size-11 rounded-[13px]',
    icon: 21,
    title: 'text-[15px]',
    text: 'text-[13px]',
  },
}

const FRAME = 'rounded-[16px] border border-fp-border bg-fp-surface shadow-fp'

export function EmptyState({
  icon: EmptyIcon,
  title,
  text,
  action,
  size = 'md',
  framed = false,
  children,
}: Props) {
  const s = SIZES[size]
  return (
    <div
      className={`flex flex-col items-center text-center ${s.box} ${framed ? FRAME : ''}`}
    >
      <span
        className={`flex flex-none items-center justify-center bg-fp-accent-soft text-fp-accent-ink ${s.tile}`}
      >
        <EmptyIcon size={s.icon} strokeWidth={2} />
      </span>
      <div className="flex max-w-[380px] flex-col gap-1">
        <p className={`font-bold text-fp-text ${s.title}`}>{title}</p>
        {text ? (
          <p className={`leading-normal text-fp-text-2 ${s.text}`}>{text}</p>
        ) : null}
      </div>
      {action ? (
        <Button
          type="button"
          disabled={action.disabled}
          onClick={action.onClick}
          className="mt-1 gap-[6px] rounded-[11px] px-[14px] py-[9px] text-[13px] font-bold"
        >
          <Plus size={15} strokeWidth={2.2} />
          {action.label}
        </Button>
      ) : null}
      {children}
    </div>
  )
}
