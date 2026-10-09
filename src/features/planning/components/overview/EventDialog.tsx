import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { StatusChip } from '#/features/planning/components/kit/StatusChip'
import type { ChipTone } from '#/features/planning/components/kit/StatusChip'
import { plural, weekdayDayMonth } from '#/features/planning/view/format'
import { daysAhead } from '#/features/planning/view/overview'
import type { DayEvent, EventCover } from '#/features/planning/view/overview'
import { cn } from '#/lib/utils'

const COVER_TONE: Record<EventCover['tone'], ChipTone> = {
  ok: 'ok',
  warn: 'warn',
  muted: 'neutral',
}

type Props = {
  /** A label's one event, or every event on a dot's day. */
  events: ReadonlyArray<DayEvent>
  onClose: () => void
  onPayNow: (event: DayEvent) => void
  /** Opens the bill's detail, or the Income section for a payday. */
  onView: (event: DayEvent) => void
}

/** A timeline event at a glance, with Pay now; a busy day lists its events first. */
export function EventDialog({ events, onClose, onPayNow, onView }: Props) {
  const [picked, setPicked] = useState<DayEvent | null>(null)
  const event = events.length === 1 ? events[0] : picked
  const first = events.at(0)
  if (!first) return null
  const when = `${weekdayDayMonth(first.date)} · ${daysAhead(first.day)}`

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={event ? event.name : weekdayDayMonth(first.date)}
      description={
        event
          ? when
          : `${plural(events.length, 'thing')} · ${daysAhead(first.day)}`
      }
      onBack={event && events.length > 1 ? () => setPicked(null) : undefined}
      contentClassName="sm:max-w-[420px]"
      footer={
        event ? (
          <EventActions event={event} onPayNow={onPayNow} onView={onView} />
        ) : undefined
      }
    >
      {event ? (
        <EventFacts event={event} />
      ) : (
        <EventList events={events} onPick={setPicked} />
      )}
    </ResponsiveDialog>
  )
}

function EventActions({
  event,
  onPayNow,
  onView,
}: {
  event: DayEvent
  onPayNow: (event: DayEvent) => void
  onView: (event: DayEvent) => void
}) {
  if (event.kind === 'payday')
    return (
      <DialogActions submitLabel="View income" onSubmit={() => onView(event)} />
    )
  return (
    <DialogActions
      extra={
        <Button
          type="button"
          variant="quiet"
          size="dialog"
          onClick={() => onView(event)}
        >
          View bill
        </Button>
      }
      submitLabel="Pay now"
      onSubmit={() => onPayNow(event)}
    />
  )
}

function EventFacts({ event: e }: { event: DayEvent }) {
  const rows: Array<[string, string]> = [
    [e.kind === 'payday' ? 'From' : 'Repeats', e.sub],
    [
      e.kind === 'payday' ? 'Into' : 'Paid from',
      e.walletName ?? 'Picked when you confirm',
    ],
    ...(e.kind === 'bill'
      ? [['Auto-pay', e.autopay ? 'On' : 'Off'] as [string, string]]
      : []),
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="size-3 flex-none rounded-full"
          style={{ background: e.color }}
        />
        <span
          className={cn(
            'fp-sensitive text-[26px] leading-none font-extrabold tracking-[-0.02em] tabular-nums',
            e.kind === 'payday' && 'text-fp-accent-ink',
          )}
        >
          {e.amount}
        </span>
        {e.cover ? (
          <StatusChip tone={COVER_TONE[e.cover.tone]} className="ms-auto">
            {e.cover.label}
          </StatusChip>
        ) : null}
      </div>
      <dl className="flex flex-col rounded-[14px] bg-fp-surface-2 px-[14px] py-1">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-t border-fp-border py-[9px] text-[13px] first:border-t-0"
          >
            <dt className="text-fp-text-2">{label}</dt>
            <dd className="min-w-0 truncate font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function EventList({
  events,
  onPick,
}: {
  events: ReadonlyArray<DayEvent>
  onPick: (event: DayEvent) => void
}) {
  return (
    <ul className="flex flex-col">
      {events.map((e) => (
        <li key={e.key} className="border-t border-fp-border first:border-t-0">
          <button
            type="button"
            onClick={() => onPick(e)}
            className="flex w-full items-center gap-3 py-[11px] text-start"
          >
            <span
              aria-hidden
              className="size-[9px] flex-none rounded-full"
              style={{ background: e.color }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">
                {e.name}
              </span>
              <span className="block truncate text-[12px] text-fp-text-3">
                {e.cover ? `${e.sub} · ${e.cover.label}` : e.sub}
              </span>
            </span>
            <span
              className={cn(
                'fp-sensitive flex-none text-[14px] font-bold tabular-nums',
                e.kind === 'payday' && 'text-fp-accent-ink',
              )}
            >
              {e.amount}
            </span>
            <ChevronRight
              size={16}
              aria-hidden
              className="flex-none text-fp-text-3 rtl:-scale-x-100"
            />
          </button>
        </li>
      ))}
    </ul>
  )
}
