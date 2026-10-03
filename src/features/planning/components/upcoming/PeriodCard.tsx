import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PeriodHead } from '#/features/planning/view/upcoming'
import { cn } from '#/lib/utils'
import { MicroLabel } from '#/features/planning/components/kit/MicroLabel'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'

export type PeriodGroup = { title: string; rows: ReactNode[] }

type Props = {
  head: PeriodHead
  groups: ReadonlyArray<PeriodGroup>
  footer: { label: string; value: string; tone?: 'ok' | 'danger' }
  /** Later periods start folded, showing this line instead of their rows. */
  summary?: string
}

/** One pay period on Upcoming: its label, title and range, its rows by kind, and a footer. */
export function PeriodCard({ head, groups, footer, summary }: Props) {
  const [open, setOpen] = useState(summary === undefined)
  const collapsible = summary !== undefined
  const titleRow = (
    <>
      <span className="text-[15px] font-extrabold tracking-[-0.01em]">
        {head.title}
      </span>
      <span className="fp-sensitive text-[12px] text-fp-text-3">
        {head.range}
      </span>
      {collapsible ? (
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            'ms-auto text-fp-text-3 transition-transform',
            open && 'rotate-180',
          )}
        />
      ) : null}
    </>
  )
  return (
    <div className="flex flex-col gap-2">
      <MicroLabel className="px-1">{head.label}</MicroLabel>
      <PlanCard className="overflow-hidden">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex w-full flex-col gap-1 px-4 py-3 text-start"
          >
            <span className="flex w-full items-baseline gap-3">{titleRow}</span>
            {!open ? (
              <span className="fp-sensitive truncate text-[12px] text-fp-text-2">
                {summary}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex items-baseline gap-3 px-4 py-3">{titleRow}</div>
        )}
        {open ? (
          <>
            {groups.map((g) =>
              g.rows.length === 0 ? null : (
                <div key={g.title}>
                  {groups.length > 1 ? (
                    <MicroLabel className="bg-fp-surface-2 px-4 py-[6px]">
                      {g.title}
                    </MicroLabel>
                  ) : null}
                  <ul>{g.rows}</ul>
                </div>
              ),
            )}
            <div className="flex items-center justify-between gap-3 border-t border-fp-border bg-fp-surface-2 px-4 py-3">
              <span className="text-[13px] font-semibold text-fp-text-2">
                {footer.label}
              </span>
              <span
                className={cn(
                  'fp-sensitive text-[15px] font-extrabold tabular-nums',
                  footer.tone === 'ok' && 'text-fp-accent-ink',
                  footer.tone === 'danger' && 'text-fp-danger',
                )}
              >
                {footer.value}
              </span>
            </div>
          </>
        ) : null}
      </PlanCard>
    </div>
  )
}
