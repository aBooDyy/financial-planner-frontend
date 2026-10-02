import type { CSSProperties, ReactNode } from 'react'
import type { LocalBill, LocalGoal } from '#/db/types'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import type { YearAhead } from '#/features/planning/data/yearAhead'
import type { CurrencyCode } from '#/lib/currency'
import { figure, money, monthYear } from '#/features/planning/view/format'
import {
  billLanes,
  goalLanes,
  monthHead,
  monthLines,
} from '#/features/planning/view/yearView'
import { cn } from '#/lib/utils'
import { Dot } from '#/features/planning/components/kit/Spine'

type Props = {
  ahead: YearAhead
  bills: ReadonlyArray<LocalBill>
  goals: ReadonlyArray<LocalGoal>
  base: CurrencyCode
  calendar: PayCalendar
  onOpen: (kind: 'bill' | 'goal', id: string) => void
  onReview: () => void
}

const LABEL =
  'sticky start-0 z-[2] flex min-w-0 flex-col justify-center border-e border-fp-border bg-fp-surface px-3 py-2'

/**
 * Grid placement for month column `i` (0-based) spanning `span` columns, on grid row `row`.
 * Rows are explicit so a goal's target cell can sit on top of its bar.
 */
const at = (row: number, i: number, span = 1): CSSProperties => ({
  gridRow: row,
  gridColumn: `${i + 2} / span ${span}`,
})

/**
 * Year ahead as lanes (desktop, design §5.1): month columns, income, monthly bills, a lane per
 * bill saved up for (ramp, then a marker on its due month), a bar per goal to its finish, and
 * what is set aside each month. Scrolls sideways; the label column sticks.
 */
export function YearLanes({
  ahead,
  bills,
  goals,
  base,
  calendar,
  onOpen,
  onReview,
}: Props) {
  const { months } = ahead
  const n = months.length
  const grid: CSSProperties = {
    gridTemplateColumns: `168px repeat(${n}, minmax(86px, 1fr))`,
    minWidth: 168 + n * 86,
  }
  const bigLanes = billLanes(ahead, bills, calendar)
  const goalRows = goalLanes(ahead, goals, calendar)
  const maxSet = Math.max(1, ...months.map((m) => m.setAside.total))
  const range = `${monthYear(`${months[0].month}-01`)} – ${monthYear(`${months[n - 1].month}-01`)}`

  let next = 1
  const row = (
    label: ReactNode,
    cells: (col: (i: number, span?: number) => CSSProperties) => ReactNode,
    key: string,
  ) => {
    const r = next++
    return (
      <div key={key} className="contents">
        <div className={LABEL} style={{ gridRow: r, gridColumn: 1 }}>
          {label}
        </div>
        {cells((i, span) => at(r, i, span))}
      </div>
    )
  }
  const group = (title: string) => (
    <div
      className="sticky start-0 bg-fp-surface-2 px-3 py-[6px] text-[11px] font-extrabold tracking-[0.06em] text-fp-text-3 uppercase"
      style={{ gridRow: next++, gridColumn: `1 / span ${n + 1}` }}
    >
      {title}
    </div>
  )

  return (
    <div className="overflow-hidden rounded-[16px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="overflow-x-auto">
        <div className="grid" style={grid}>
          {row(
            <span className="text-[11px] font-extrabold text-fp-text-3 uppercase">
              {range}
            </span>,
            (col) =>
              months.map((m, i) => {
                const head = monthHead(months, i)
                const lines = monthLines(m, bills, goals, base)
                return (
                  <Popover key={m.month}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'flex flex-col items-center justify-center py-2 text-[13px] font-extrabold hover:bg-fp-surface-2',
                          i === 0 && 'bg-fp-accent-soft text-fp-accent-ink',
                        )}
                        style={col(i)}
                      >
                        {head.name}
                        {head.year ? (
                          <span className="text-[10.5px] font-bold text-fp-text-3">
                            {head.year}
                          </span>
                        ) : null}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[290px] p-3">
                      <p className="mb-2 text-[14px] font-extrabold">
                        {monthYear(`${m.month}-01`)}
                      </p>
                      {lines.length === 0 ? (
                        <p className="text-[12.5px] text-fp-text-3">
                          Nothing planned this month.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-[6px]">
                          {lines.map((l) => (
                            <li key={l.key}>
                              <button
                                type="button"
                                disabled={!l.ownerId}
                                onClick={() =>
                                  l.ownerId && l.kind !== 'monthly'
                                    ? onOpen(l.kind, l.ownerId)
                                    : undefined
                                }
                                className="flex w-full items-center gap-2 text-start text-[12.5px]"
                              >
                                <Dot color={l.color} />
                                <span className="min-w-0 flex-1 truncate font-semibold">
                                  {l.name}
                                </span>
                                <span className="text-fp-text-3">{l.note}</span>
                                <span
                                  className={cn(
                                    'fp-sensitive font-bold tabular-nums',
                                    l.setAside && 'text-fp-transfer',
                                  )}
                                >
                                  {l.amount}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </PopoverContent>
                  </Popover>
                )
              }),
            'head',
          )}

          {/* Income */}
          {group('Income')}
          {row(
            <span className="text-[13px] font-bold">Coming in</span>,
            (col) =>
              months.map((m, i) => (
                <span
                  key={m.month}
                  className="fp-sensitive flex items-center justify-center py-2 text-[12px] font-bold text-fp-accent-ink tabular-nums"
                  style={col(i)}
                >
                  {m.income > 0 ? `+${figure(m.income, base)}` : '—'}
                </span>
              )),
            'income',
          )}

          {/* Bills */}
          {group(
            `Bills · ${money(months[0].monthlyBills.total, base)} this month`,
          )}
          {row(
            <>
              <span className="text-[13px] font-bold">Monthly bills</span>
              <span className="text-[11px] text-fp-text-3">
                {months[0].monthlyBills.items.length} this month
              </span>
            </>,
            (col) =>
              months.map((m, i) => (
                <span
                  key={m.month}
                  className="fp-sensitive flex items-center justify-center py-2 text-[12px] font-bold text-fp-text-2 tabular-nums"
                  style={col(i)}
                >
                  {m.monthlyBills.total > 0
                    ? figure(m.monthlyBills.total, base)
                    : '—'}
                </span>
              )),
            'monthly',
          )}
          {bigLanes.map((lane) =>
            row(
              <button
                type="button"
                onClick={() => onOpen('bill', lane.billId)}
                className="flex min-w-0 flex-col text-start"
              >
                <span className="flex items-center gap-[6px] text-[13px] font-bold">
                  <Dot color={lane.color} />
                  <span className="truncate">{lane.name}</span>
                </span>
                <span className="truncate text-[11px] text-fp-text-3">
                  {lane.sub}
                </span>
              </button>,
              (col) => (
                <>
                  {lane.ramps.map((r) => (
                    <span
                      key={`r${r.from}`}
                      title={r.title}
                      className="flex items-center px-1"
                      style={col(r.from, r.to - r.from + 1)}
                    >
                      <span className="h-2 w-full overflow-hidden rounded-full bg-fp-transfer-soft">
                        <span
                          className="block h-full rounded-full bg-fp-chart-set-aside"
                          style={{ width: `${r.progress * 100}%` }}
                        />
                      </span>
                    </span>
                  ))}
                  {lane.markers.map((mk) => (
                    <button
                      key={`m${mk.index}`}
                      type="button"
                      onClick={() => onOpen('bill', lane.billId)}
                      className="flex flex-col items-center justify-center py-2"
                      style={col(mk.index)}
                    >
                      <span
                        aria-hidden
                        className="size-[10px] rotate-45 rounded-[2px]"
                        style={{ background: lane.color }}
                      />
                      <span className="fp-sensitive mt-1 text-[12px] font-extrabold tabular-nums">
                        {mk.amount}
                      </span>
                      <span className="text-[10.5px] text-fp-text-3">
                        {mk.date}
                      </span>
                    </button>
                  ))}
                </>
              ),
              `bill-${lane.billId}`,
            ),
          )}

          {/* Goals */}
          {goalRows.length > 0 ? group('Goals') : null}
          {goalRows.map((g) =>
            row(
              <button
                type="button"
                onClick={() => onOpen('goal', g.goalId)}
                className="flex min-w-0 items-center gap-[6px] text-start text-[13px] font-bold"
              >
                <Dot color={g.color} />
                <span className="truncate">{g.name}</span>
              </button>,
              (col) => (
                <>
                  {g.span ? (
                    <button
                      type="button"
                      onClick={() => onOpen('goal', g.goalId)}
                      className={cn(
                        'my-2 flex items-center truncate rounded-[8px] px-2 py-[5px] text-start text-[11.5px] font-bold',
                        g.paused && 'opacity-50',
                        g.slips && 'text-fp-warn',
                      )}
                      style={{
                        ...col(g.span.from, g.span.to - g.span.from + 1),
                        background: g.slips
                          ? 'color-mix(in srgb, var(--fp-warn) 15%, transparent)'
                          : `color-mix(in srgb, ${g.color} 15%, transparent)`,
                      }}
                    >
                      <span className="fp-sensitive truncate">{g.label}</span>
                    </button>
                  ) : (
                    <span
                      className="flex items-center px-2 text-[11.5px] text-fp-text-3"
                      style={col(0, n)}
                    >
                      {g.label}
                    </span>
                  )}
                  {g.target ? (
                    <span
                      className="fp-sensitive pointer-events-none z-[1] my-2 flex items-center justify-center rounded-[8px] border-[1.5px] text-[11px] font-extrabold"
                      style={{ ...col(g.target.index), borderColor: g.color }}
                    >
                      {g.target.amount}
                    </span>
                  ) : null}
                </>
              ),
              `goal-${g.goalId}`,
            ),
          )}

          {/* Set aside */}
          {group('Set aside each month')}
          {row(
            <button
              type="button"
              onClick={onReview}
              className="flex flex-col text-start"
            >
              <span className="text-[13px] font-bold">Total set aside</span>
              <span className="text-[11px] text-fp-text-3">bills + goals</span>
            </button>,
            (col) =>
              months.map((m, i) => (
                <span
                  key={m.month}
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2"
                  style={col(i)}
                >
                  <span className="fp-sensitive text-[11.5px] font-extrabold text-fp-transfer tabular-nums">
                    {m.setAside.total > 0
                      ? figure(m.setAside.total, base)
                      : '—'}
                  </span>
                  <span
                    className="flex h-[6px] gap-px self-start overflow-hidden rounded-full"
                    style={{ width: `${(m.setAside.total / maxSet) * 100}%` }}
                  >
                    {m.setAside.byOwner.map((o) => (
                      <span
                        key={`${o.kind}${o.ownerId}`}
                        style={{
                          flexGrow: o.amount,
                          background: o.color || 'var(--fp-chart-set-aside)',
                        }}
                      />
                    ))}
                  </span>
                </span>
              )),
            'setaside',
          )}
        </div>
      </div>
      <p className="border-t border-fp-border px-4 py-2 text-[12px] text-fp-text-3">
        Tap a month to see everything in it. Tap a bill or goal to open it.
      </p>
    </div>
  )
}
