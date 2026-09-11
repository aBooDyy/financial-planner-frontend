import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle: string
  action?: ReactNode
}

export function SectionHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[20px] font-extrabold tracking-[-0.01em]">
          {title}
        </div>
        <div className="mt-[3px] text-[13px] text-fp-text-2">{subtitle}</div>
      </div>
      {action}
    </div>
  )
}
