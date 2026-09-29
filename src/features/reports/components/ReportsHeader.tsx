import type { ReactNode } from 'react'

type Props = {
  /** Sits at the header's end on desktop, e.g. the account filter. */
  trailing: ReactNode
}

export function ReportsHeader({ trailing }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h1 className="text-[22px] font-extrabold tracking-[-0.025em] md:text-[26px]">
          Reports
        </h1>
        <p className="hidden text-[13px] text-fp-text-3 md:block">
          Income and spending over any period. Transfers between your accounts
          are left out.
        </p>
      </div>
      <div className="flex-1" />
      <div className="hidden md:block">{trailing}</div>
    </div>
  )
}
