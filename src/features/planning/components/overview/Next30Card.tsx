import { useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from '#/components/ui/skeleton'
import { addDaysISO } from '#/features/planned/data/dates'
import type { UpcomingRow } from '#/features/planning/data/upcoming'
import { dayMonth, weekdayDayMonth } from '#/features/planning/view/format'
import { useElementWidth } from '#/features/planning/hooks/useElementWidth'
import {
  NEXT_DAYS,
  groupByDay,
  placeLabels,
} from '#/features/planning/view/overview'
import type {
  DayEvent,
  DayGroup,
  LabelSide,
} from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'
import {
  CardHeader,
  PlanCard,
} from '#/features/planning/components/kit/PlanCard'
import { EventTip } from './EventTip'

/** The least room (px) between two labels on the same side of the axis. */
const LABEL_GAP_PX = 104
/** Used until the axis is measured. */
const FALLBACK_WIDTH = 700
const TICKS = [0, 7, 14, 21, 28]
/** Where placeholder events sit on the axis while the plan loads. */
const LOADING_DAYS = [4, 12, 19, 26]

type Props = {
  /** `null` while the plan loads. */
  events: ReadonlyArray<DayEvent> | null
  due: ReadonlyArray<UpcomingRow>
  today: string
  onSeeAll: () => void
  /** The events of one label or one day's dot. */
  onEvent: (events: ReadonlyArray<DayEvent>) => void
}

/** Next 30 days (04 §5): bills and paydays on a 30-day axis, and what waits to be confirmed. */
export function Next30Card({ events, due, today, onSeeAll, onEvent }: Props) {
  return (
    <PlanCard>
      <CardHeader
        title="Next 30 days"
        end={
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[12.5px] font-bold text-fp-accent-ink hover:underline"
          >
            See all <span className="inline-block rtl:-scale-x-100">→</span>
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-[18px] pb-4">
        {due.length > 0 ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-2 rounded-[11px] border border-fp-warn-line bg-fp-warn-soft px-3 py-[9px] text-start text-[13px]"
          >
            <span
              aria-hidden
              className="size-[7px] flex-none rounded-full bg-fp-warn-fill"
            />
            <span className="flex-none font-extrabold text-fp-warn">
              {due.length} to confirm
            </span>
            <span className="min-w-0 flex-1 truncate text-fp-text-2">
              {due
                .map((r) => `${r.name} · ${dayMonth(r.item.date)}`)
                .join(', ')}
            </span>
            <ChevronRight
              size={15}
              aria-hidden
              className="flex-none text-fp-warn rtl:-scale-x-100"
            />
          </button>
        ) : null}
        {events === null ? (
          <>
            <Timeline events={[]} today={today} onEvent={onEvent} loading />
            <MobileListSkeleton />
          </>
        ) : events.length === 0 ? (
          <p className="text-[13px] text-fp-text-3">
            No bills or paydays in the next 30 days.
          </p>
        ) : (
          <>
            <Timeline events={events} today={today} onEvent={onEvent} />
            <MobileList events={events} onEvent={onEvent} />
          </>
        )}
      </div>
    </PlanCard>
  )
}

const pctOf = (day: number) =>
  (Math.min(NEXT_DAYS, Math.max(0, day)) / NEXT_DAYS) * 100

/** Desktop: a dot per day on an axis, each event's label above or below it on a stem. */
function Timeline({
  events,
  today,
  onEvent,
  loading,
}: {
  events: ReadonlyArray<DayEvent>
  today: string
  onEvent: (events: ReadonlyArray<DayEvent>) => void
  /** Placeholder dots and labels stand where the events will be. */
  loading?: boolean
}) {
  const axis = useRef<HTMLDivElement>(null)
  const width = useElementWidth(axis, FALLBACK_WIDTH)
  const sides = placeLabels(
    events.map((e) => (pctOf(e.day) / 100) * width),
    LABEL_GAP_PX,
  )
  return (
    <div ref={axis} className="relative mx-11 hidden h-[136px] md:block">
      <div className="absolute inset-x-0 top-[61px] h-[2px] rounded-full bg-fp-border-strong" />
      {loading ? <TimelineSkeleton /> : null}
      {events.map((e, i) =>
        sides[i].labelled ? (
          <EventLabel
            key={e.key}
            event={e}
            side={sides[i].side}
            at={pctOf(e.day)}
            onClick={() => onEvent([e])}
          />
        ) : null,
      )}
      {groupByDay(events).map((g) => (
        <DayDot
          key={g.date}
          group={g}
          tipSide={freeSide(
            events.flatMap((e, i) =>
              e.date === g.date && sides[i].labelled ? [sides[i].side] : [],
            ),
          )}
          onClick={() => onEvent(g.events)}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-4">
        {TICKS.map((day) => (
          <span
            key={day}
            className={cn(
              'absolute -translate-x-1/2 text-[10.5px] font-bold whitespace-nowrap rtl:translate-x-1/2',
              day === 0 ? 'text-fp-accent-ink' : 'text-fp-text-3',
            )}
            style={{ insetInlineStart: `${pctOf(day)}%` }}
          >
            {day === 0 ? 'Today' : dayMonth(addDaysISO(today, day))}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Where a dot's tooltip goes so it covers none of its day's labels. */
function freeSide(
  labelled: ReadonlyArray<LabelSide>,
): 'top' | 'bottom' | 'right' {
  if (!labelled.includes('above')) return 'top'
  if (!labelled.includes('below')) return 'bottom'
  return 'right'
}

/** One event's name and amount, on a stem reaching to the axis. */
function EventLabel({
  event: e,
  side,
  at,
  onClick,
}: {
  event: DayEvent
  side: LabelSide
  at: number
  onClick: () => void
}) {
  return (
    <EventTip events={[e]} side={side === 'above' ? 'top' : 'bottom'}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${e.name} · ${weekdayDayMonth(e.date)} · ${e.amount}`}
        className={cn(
          'group absolute flex w-max -translate-x-1/2 flex-col items-center rounded-[8px] px-[6px] py-[2px] text-center transition-colors hover:bg-fp-surface-2 rtl:translate-x-1/2',
          side === 'above' ? 'bottom-[92px]' : 'top-[80px]',
        )}
        style={{ insetInlineStart: `${at}%` }}
      >
        <span
          aria-hidden
          className={cn(
            'absolute start-1/2 h-[18px] w-px bg-fp-border-strong',
            side === 'above' ? '-bottom-[18px]' : '-top-[18px]',
          )}
        />
        <span className="max-w-[110px] truncate text-[12px] font-bold">
          {e.name}
        </span>
        <span
          className={cn(
            'fp-sensitive text-[11.5px] tabular-nums',
            e.kind === 'payday' ? 'text-fp-accent-ink' : 'text-fp-text-2',
          )}
        >
          {e.amount}
        </span>
      </button>
    </EventTip>
  )
}

/** A day's dot on the axis, split between its events' colours when it has several. */
function DayDot({
  group,
  tipSide,
  onClick,
}: {
  group: DayGroup
  tipSide: 'top' | 'bottom' | 'right'
  onClick: () => void
}) {
  const { events } = group
  const fill =
    events.length === 1
      ? events[0].color
      : `conic-gradient(${events
          .map(
            (e, i) =>
              `${e.color} ${(i / events.length) * 100}% ${((i + 1) / events.length) * 100}%`,
          )
          .join(', ')})`
  return (
    <EventTip events={events} side={tipSide}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${weekdayDayMonth(group.date)} · ${events.map((e) => e.name).join(', ')}`}
        className="group absolute top-[50px] z-[1] flex size-6 -translate-x-1/2 items-center justify-center rounded-full rtl:translate-x-1/2"
        style={{ insetInlineStart: `${pctOf(group.day)}%` }}
      >
        <span
          className={cn(
            'block size-3 rounded-full ring-2 ring-fp-surface transition-transform group-hover:scale-125',
            events.some((e) => e.kind === 'payday') &&
              'outline-2 outline-offset-1 outline-fp-accent',
          )}
          style={{ background: fill }}
        />
      </button>
    </EventTip>
  )
}

/** The axis's events while the plan loads: dots, with labels alternating above and below. */
function TimelineSkeleton() {
  return (
    <div aria-hidden>
      {LOADING_DAYS.map((day, i) => (
        <span
          key={day}
          className="absolute top-[56px] -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${pctOf(day)}%` }}
        >
          <Skeleton className="size-3 rounded-full" />
          <span
            className={cn(
              'absolute start-1/2 flex -translate-x-1/2 flex-col items-center gap-[5px] rtl:translate-x-1/2',
              i % 2 === 0 ? 'bottom-[24px]' : 'top-[24px]',
            )}
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-12" />
          </span>
        </span>
      ))}
    </div>
  )
}

/** Mobile while the plan loads: the bare strip, then placeholder rows. */
function MobileListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 md:hidden">
      <div className="relative mx-2 h-[26px]">
        <div className="absolute inset-x-0 top-[12px] h-[2px] rounded-full bg-fp-border-strong" />
      </div>
      <ul className="flex flex-col">
        {LOADING_DAYS.map((day) => (
          <li key={day} className="flex h-[34px] items-center gap-[10px]">
            <Skeleton className="h-3 w-[38px] flex-none" />
            <Skeleton className="size-2 flex-none rounded-full" />
            <Skeleton className="h-3.5 w-2/5" />
            <span className="flex-1" />
            <Skeleton className="h-3.5 w-16" />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Mobile: a strip of dots, then the list. */
function MobileList({
  events,
  onEvent,
}: {
  events: ReadonlyArray<DayEvent>
  onEvent: (events: ReadonlyArray<DayEvent>) => void
}) {
  return (
    <div className="flex flex-col gap-2 md:hidden">
      <div className="relative mx-2 h-[26px]">
        <div className="absolute inset-x-0 top-[12px] h-[2px] rounded-full bg-fp-border-strong" />
        {events.map((e) => (
          <span
            key={e.key}
            aria-hidden
            className="absolute top-[8px] size-[10px] -translate-x-1/2 rounded-full ring-2 ring-fp-surface rtl:translate-x-1/2"
            style={{
              insetInlineStart: `${pctOf(e.day)}%`,
              background: e.color,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col">
        {events.map((e) => (
          <li key={e.key}>
            <button
              type="button"
              onClick={() => onEvent([e])}
              className="flex w-full items-center gap-[10px] py-[7px] text-start text-[13px]"
            >
              <span className="w-[44px] flex-none text-[12px] font-bold text-fp-text-3">
                {dayMonth(e.date)}
              </span>
              <span
                aria-hidden
                className="size-2 flex-none rounded-full"
                style={{ background: e.color }}
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {e.name}
              </span>
              <span
                className={cn(
                  'fp-sensitive font-bold tabular-nums',
                  e.kind === 'payday' && 'text-fp-accent-ink',
                )}
              >
                {e.amount}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
