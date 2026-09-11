import { useMemo, useState } from 'react'
import { CalendarDays, List } from 'lucide-react'
import type { GoalsView, PlanMonth } from '#/features/goals/data/selectors'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'

type Props = { view: GoalsView }
type Mode = 'list' | 'calendar'

/** Stacked bar of a month's set-aside, split by goal color (empty track when nothing is set aside). */
function ShareBar({ month, height }: { month: PlanMonth; height: number }) {
  return (
    <div
      className="flex overflow-hidden rounded-[4px] bg-fp-surface-2"
      style={{ height }}
    >
      {month.shares.map((s) => (
        <div
          key={s.goalId}
          className="h-full"
          style={{ width: `${s.pct}%`, background: s.color }}
        />
      ))}
    </div>
  )
}

function MonthRow({ month }: { month: PlanMonth }) {
  return (
    <div className="border-b border-dashed border-fp-border pb-3 last:border-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold tabular-nums">
          {month.label}
        </span>
        <span
          className={`text-[13px] font-extrabold tabular-nums ${month.muted ? 'text-fp-text-3' : ''}`}
        >
          {month.muted ? '—' : month.totalStr}
        </span>
      </div>
      <div className="mt-[6px]">
        <ShareBar month={month} height={8} />
      </div>
      {month.muted ? (
        <div className="mt-[6px] text-[11.5px] text-fp-text-3">
          Nothing set aside
        </div>
      ) : (
        <div className="mt-[8px] flex flex-col gap-[4px]">
          {month.shares.map((s) => (
            <div
              key={s.goalId}
              className="flex items-center justify-between gap-2 text-[12px]"
            >
              <span className="flex min-w-0 items-center gap-[7px]">
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: s.color }}
                />
                <span className="truncate text-fp-text-2">{s.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {s.amountStr}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthCell({ month }: { month: PlanMonth }) {
  const detail = month.muted
    ? 'Nothing set aside'
    : month.shares.map((s) => `${s.name}: ${s.amountStr}`).join('\n')
  return (
    <div
      className="rounded-[12px] border border-fp-border p-[10px]"
      title={`${month.label}\n${detail}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[12px] font-bold">{month.monthShort}</span>
        <span
          className={`text-[11px] font-extrabold tabular-nums ${month.muted ? 'text-fp-text-3' : ''}`}
        >
          {month.muted ? '—' : month.totalStr}
        </span>
      </div>
      <div className="mt-[7px]">
        <ShareBar month={month} height={7} />
      </div>
    </div>
  )
}

export function MonthlyPlanCard({ view }: Props) {
  const [mode, setMode] = useState<Mode>('list')
  const { monthlyPlan } = view

  const legend = useMemo(() => {
    const seen = new Set<string>()
    const out: { id: string; name: string; color: string }[] = []
    for (const month of monthlyPlan) {
      for (const s of month.shares) {
        if (seen.has(s.goalId)) continue
        seen.add(s.goalId)
        out.push({ id: s.goalId, name: s.name, color: s.color })
      }
    }
    return out
  }, [monthlyPlan])

  const byYear = useMemo(() => {
    const years: number[] = []
    const map = new Map<number, PlanMonth[]>()
    for (const month of monthlyPlan) {
      const bucket = map.get(month.year)
      if (bucket) bucket.push(month)
      else {
        map.set(month.year, [month])
        years.push(month.year)
      }
    }
    return years.map((year) => ({ year, months: map.get(year) ?? [] }))
  }, [monthlyPlan])

  const hasPlan = legend.length > 0

  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex min-w-0 flex-col">
          <span className="text-[15px] font-bold">Monthly plan</span>
          <span className="text-[12px] text-fp-text-3">
            Where each month's set-aside goes
          </span>
        </div>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as Mode)}
          variant="outline"
        >
          <ToggleGroupItem value="list" aria-label="List view" className="px-3">
            <List size={14} strokeWidth={2} />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="calendar"
            aria-label="Calendar view"
            className="px-3"
          >
            <CalendarDays size={14} strokeWidth={2} />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!hasPlan ? (
        <div className="px-4 py-6 text-[13px] text-fp-text-3">
          Add income and a goal, and the month-by-month set-aside plan shows up
          here.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-[6px] border-b border-fp-border px-4 py-3">
            {legend.map((g) => (
              <span
                key={g.id}
                className="flex items-center gap-[6px] text-[11.5px] text-fp-text-2"
              >
                <span
                  className="h-[8px] w-[8px] rounded-full"
                  style={{ background: g.color }}
                />
                {g.name}
              </span>
            ))}
          </div>

          <div className="max-h-[440px] overflow-auto p-4">
            {mode === 'list' ? (
              <div className="flex flex-col gap-3">
                {monthlyPlan.map((month) => (
                  <MonthRow key={month.key} month={month} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {byYear.map(({ year, months }) => (
                  <div key={year}>
                    <div className="mb-[8px] text-[11px] font-bold tracking-[0.03em] text-fp-text-3">
                      {year}
                    </div>
                    <div className="grid grid-cols-3 gap-[8px] sm:grid-cols-4">
                      {months.map((month) => (
                        <MonthCell key={month.key} month={month} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
