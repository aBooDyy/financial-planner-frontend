import { useNavigate } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useLastMonthNeedsWants } from '#/features/reports/hooks/useLastMonthNeedsWants'

/**
 * "Last month: Needs 48% · Wants 31% · Savings 21% →" under Each paycheck — how last calendar
 * month's income was really used, opening that month in Reports. Nothing until there is a split.
 */
export function LastMonthLine() {
  const { summary, reportSearch } = useLastMonthNeedsWants()
  const navigate = useNavigate()
  if (!summary?.line) return null
  return (
    <button
      type="button"
      onClick={() => void navigate({ to: '/reports', search: reportSearch })}
      className="flex w-full items-center gap-[6px] border-t border-fp-border px-[18px] py-[11px] text-start text-[12.5px] font-semibold text-fp-text-2 hover:bg-fp-surface-2"
    >
      <span className="min-w-0 truncate">
        Last month:{' '}
        <span className="fp-sensitive font-bold text-fp-text">
          {summary.line}
        </span>
      </span>
      <ArrowRight
        size={14}
        aria-hidden
        className="flex-none text-fp-accent-ink rtl:-scale-x-100"
      />
    </button>
  )
}
