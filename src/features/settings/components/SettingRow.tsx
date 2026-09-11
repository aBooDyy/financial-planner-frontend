import type { ReactNode } from 'react'

type Props = {
  label: string
  desc?: string
  children: ReactNode
  last?: boolean
}

/** One labelled row inside a settings card: text on the start side, a control on the end. */
export function SettingRow({ label, desc, children, last }: Props) {
  return (
    <div
      className={`flex items-center gap-4 px-[18px] py-[15px] ${
        last ? '' : 'border-b border-fp-border'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">{label}</div>
        {desc ? (
          <div className="mt-0.5 text-[12.5px] text-fp-text-3">{desc}</div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
