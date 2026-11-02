import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Skeleton } from '#/components/ui/skeleton'
import {
  CardHeader,
  PlanCard,
} from '#/features/planning/components/kit/PlanCard'
import type { BillsYear } from '#/features/planning/data/billsYear'
import type { PlanningSection } from '#/features/planning/sections'
import {
  money,
  monthShort,
  monthYear,
  signedMoney,
} from '#/features/planning/view/format'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'

type Props = {
  /** `null` while the plan loads. */
  year: BillsYear | null
  base: CurrencyCode
  onSection: (section: PlanningSection) => void
}

/**
 * What bills cost a month and a year, how the twelve months differ, and what that leaves of the
 * year's income. Nothing when no bill falls in the year.
 */
export function YearOfBillsCard({ year, base, onSection }: Props) {
  if (year?.total === 0) return null
  const months = year?.months
  return (
    <PlanCard>
      <CardHeader
        title="Your bills over a year"
        note={
          months
            ? `${monthYear(`${months[0].month}-01`)} – ${monthYear(`${months[11].month}-01`)}`
            : null
        }
      />
      <div className="grid gap-x-8 gap-y-4 px-[18px] pb-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:content-center">
          <Stat
            label="A month"
            sub="on average"
            value={year ? money(year.perMonth, base) : undefined}
          />
          <Stat
            label="A year"
            sub="in total"
            value={year ? money(year.total, base) : undefined}
          />
        </div>
        {year ? (
          <MonthBars months={year.months} base={base} />
        ) : (
          <Skeleton aria-hidden className="h-[112px] w-full" />
        )}
      </div>
      {year?.estimated ? (
        <p className="px-[18px] pb-3 text-[12px] text-fp-text-3">
          Some bills are estimates or have no amount yet, so the real total may
          differ.
        </p>
      ) : null}
      {year && year.income > 0 ? (
        <YearLeftover year={year} base={base} onSection={onSection} />
      ) : null}
    </PlanCard>
  )
}

function Stat({
  label,
  sub,
  value,
}: {
  label: string
  sub: string
  value: string | undefined
}) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-semibold text-fp-text-2">
        {label} <span className="font-normal text-fp-text-3">{sub}</span>
      </p>
      <div className="fp-sensitive mt-[2px] truncate text-[24px] font-extrabold tracking-[-0.02em] tabular-nums">
        <ValueOrSkeleton value={value} className="h-7 w-28" />
      </div>
    </div>
  )
}

/** One bar per month; the heaviest is read out until another is hovered, focused or tapped. */
function MonthBars({
  months,
  base,
}: {
  months: BillsYear['months']
  base: CurrencyCode
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const highest = Math.max(...months.map((m) => m.amount))
  const heaviest = months.findIndex((m) => m.amount === highest)
  const shown = picked ?? heaviest
  const month = months[shown]
  return (
    <div className="min-w-0" onMouseLeave={() => setPicked(null)}>
      <p aria-live="polite" className="mb-2 truncate text-[12.5px]">
        <span className="font-semibold text-fp-text-2">
          {shown === heaviest ? 'Heaviest month · ' : ''}
          {monthYear(`${month.month}-01`)}
        </span>{' '}
        <span className="fp-sensitive font-extrabold tabular-nums">
          {money(month.amount, base)}
        </span>
      </p>
      <div className="flex gap-[2px]">
        {months.map((m, i) => (
          <button
            key={m.month}
            type="button"
            aria-label={`${monthYear(`${m.month}-01`)}: ${money(m.amount, base)}`}
            aria-pressed={i === shown}
            onMouseEnter={() => setPicked(i)}
            onFocus={() => setPicked(i)}
            onClick={() => setPicked(i)}
            className="group flex min-w-0 flex-1 flex-col items-stretch gap-1"
          >
            <span className="flex h-[72px] items-end">
              <span
                className={cn(
                  'fp-sensitive w-full rounded-t-[4px] transition-colors',
                  i === shown
                    ? 'bg-fp-text'
                    : 'bg-fp-text-3 group-hover:bg-fp-text-2',
                )}
                style={{
                  height:
                    m.amount > 0
                      ? `max(3px, ${(m.amount / highest) * 100}%)`
                      : 0,
                }}
              />
            </span>
            <span
              className={cn(
                'text-center text-[10px] font-semibold',
                i === shown ? 'text-fp-text' : 'text-fp-text-3',
              )}
            >
              {monthShort(`${m.month}-01`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function YearLeftover({
  year,
  base,
  onSection,
}: {
  year: BillsYear
  base: CurrencyCode
  onSection: (section: PlanningSection) => void
}) {
  const left = year.income - year.total
  const share = Math.round((year.total / year.income) * 100)
  return (
    <ul className="border-t border-fp-border px-[14px] py-1">
      <LeftoverRow
        label="Income"
        amount={money(year.income, base)}
        onClick={() => onSection('income')}
      />
      <LeftoverRow
        label="Bills"
        note={[
          `${share}% of income`,
          year.niceToHave > 0
            ? `${money(year.niceToHave, base)} nice to have`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        amount={money(year.total, base)}
        onClick={() => onSection('bills')}
      />
      <LeftoverRow
        label="Left after bills"
        note="for goals and spending"
        amount={signedMoney(left, base)}
        danger={left < 0}
      />
    </ul>
  )
}

function LeftoverRow({
  label,
  note,
  amount,
  danger,
  onClick,
}: {
  label: string
  note?: string
  amount: ReactNode
  danger?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:gap-[10px]">
        <span className="text-[13.5px] font-bold">{label}</span>
        {note ? (
          <span className="fp-sensitive text-[12px] text-fp-text-3">
            {note}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'fp-sensitive text-[13.5px] font-extrabold tabular-nums',
          danger && 'text-fp-danger',
        )}
      >
        {amount}
      </span>
    </>
  )
  const row = 'flex w-full items-center gap-[10px] px-1 py-[10px] text-start'
  return (
    <li className="border-t border-fp-border first:border-t-0">
      {onClick ? (
        <button type="button" onClick={onClick} className={row}>
          {body}
          <ChevronRight
            size={15}
            aria-hidden
            className="flex-none text-fp-text-3 rtl:-scale-x-100"
          />
        </button>
      ) : (
        <div className={cn(row, 'pe-[29px]')}>{body}</div>
      )}
    </li>
  )
}
