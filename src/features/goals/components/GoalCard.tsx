import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  PiggyBank,
  Repeat,
  SquarePen,
  Target,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GoalKind } from '#/features/goals/api/types'
import { STATUS_COLORS } from '#/features/goals/constants'
import type { GoalCard as GoalCardData } from '#/features/goals/data/selectors'
import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { usePreferencesStore } from '#/stores/preferences'

const KIND_ICON: Record<GoalKind, LucideIcon> = {
  onetime: Target,
  recurring: Repeat,
  openended: PiggyBank,
  sinking: CalendarDays,
}

type Props = {
  card: GoalCardData
  onUp: () => void
  onDown: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDateChange: (id: string, iso: string) => void
}

const STEP =
  'h-4 w-5 rounded-none p-0 text-fp-text-3 hover:bg-transparent disabled:pointer-events-none disabled:opacity-30'
const ICON_BTN =
  'h-7 w-7 rounded-[8px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text'

export function GoalCard({
  card,
  onUp,
  onDown,
  onEdit,
  onDelete,
  onDateChange,
}: Props) {
  const status = STATUS_COLORS[card.status]
  const Icon = KIND_ICON[card.kind]
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <div
      className="mb-[9px] rounded-[14px] border border-fp-border p-[13px] last:mb-0"
      style={{
        background: card.isOver ? 'var(--fp-surface-2)' : 'var(--fp-surface)',
      }}
    >
      <div className="flex items-start gap-[11px]">
        <div className="flex flex-col items-center gap-[2px] pt-px">
          <Button
            variant="ghost"
            size="icon"
            title="Higher priority"
            disabled={!card.canUp}
            onClick={onUp}
            className={`${STEP} ${card.canUp ? 'cursor-pointer' : 'cursor-default opacity-30'}`}
          >
            <ChevronUp size={14} strokeWidth={2.4} />
          </Button>
          <span className="text-[11px] font-extrabold text-fp-text-3 tabular-nums">
            {card.rank}
          </span>
          <Button
            variant="ghost"
            size="icon"
            title="Lower priority"
            disabled={!card.canDown}
            onClick={onDown}
            className={`${STEP} ${card.canDown ? 'cursor-pointer' : 'cursor-default opacity-30'}`}
          >
            <ChevronDown size={14} strokeWidth={2.4} />
          </Button>
        </div>

        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: `${card.color}22`, color: card.color }}
        >
          <Icon size={17} strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px]">
            <span className="text-[14.5px] font-bold">{card.name}</span>
            <span className="rounded-full border border-fp-border bg-fp-surface-2 px-2 py-[2px] text-[10.5px] font-bold tracking-[0.03em] text-fp-text-2 uppercase">
              {card.kindLabel}
            </span>
          </div>
          <div className="mt-[3px] text-[12px] text-fp-text-3">
            {card.metaStr}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <span
            className="text-[15px] font-extrabold tracking-[-0.01em] whitespace-nowrap tabular-nums"
            style={card.isDeferred ? { color: 'var(--fp-text-3)' } : undefined}
          >
            {card.monthlyStr}
            <span className="text-[11px] font-semibold text-fp-text-3">
              /mo
            </span>
          </span>
          {card.monthlySubStr ? (
            <span className="text-[10px] font-semibold text-fp-text-3">
              {card.monthlySubStr}
            </span>
          ) : null}
          <span
            className="mt-[4px] inline-flex items-center gap-[5px] rounded-full px-2 py-[2px] text-[11px] font-bold"
            style={{ color: status.main, background: status.soft }}
          >
            <span
              className="h-[6px] w-[6px] rounded-full"
              style={{ background: status.main }}
            />
            {card.statusLabel}
          </span>
        </div>

        <div className="flex flex-col gap-px">
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            onClick={() => onEdit(card.id)}
            className={ICON_BTN}
          >
            <SquarePen size={14} strokeWidth={1.8} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            onClick={() => onDelete(card.id)}
            className={`${ICON_BTN} hover:!text-fp-danger`}
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      <div className="mt-[11px] flex items-center gap-[11px]">
        <div className="h-[7px] flex-1 overflow-hidden rounded-[5px] bg-fp-surface-2">
          <div
            className="h-full rounded-[5px] transition-[width] duration-200"
            style={{ width: `${card.fundedPct}%`, background: status.main }}
          />
        </div>
        <span
          className="min-w-[34px] text-end text-[12px] font-bold tabular-nums"
          style={{ color: status.main }}
        >
          {card.fundedStr}
        </span>
      </div>

      {card.hasDate ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-[10px] border-t border-dashed border-fp-border pt-3">
          <div className="flex items-center gap-[9px]">
            <span className="text-[11.5px] font-semibold text-fp-text-2">
              {card.dateLabel}
            </span>
            <DateField
              value={card.dateISO}
              onChange={(iso) => onDateChange(card.id, iso)}
              dateFormat={dateFormat}
              ariaLabel={card.dateLabel}
              boxClassName="rounded-[9px] px-[9px] py-[6px] text-[12.5px] font-semibold"
              iconSize={14}
            />
          </div>
          <span className="text-[11.5px] text-fp-text-3 tabular-nums">
            {card.dateHelper}
          </span>
        </div>
      ) : null}

      {card.hasSchedule ? (
        <Collapsible className="group/schedule mt-3 border-t border-dashed border-fp-border pt-3">
          <CollapsibleTrigger className="flex w-full cursor-pointer list-none items-center gap-[7px] text-[11.5px]">
            <ChevronRight
              size={13}
              strokeWidth={2.4}
              className="shrink-0 text-fp-text-3 transition-transform group-data-[state=open]/schedule:rotate-90"
            />
            <span className="font-bold text-fp-text-2">Monthly plan</span>
            <span className="truncate text-fp-text-3 tabular-nums">
              {card.scheduleSummary}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-[10px]">
            <div
              className="mb-[9px] text-[11px] font-semibold"
              style={{ color: status.main }}
            >
              {card.coverageStr}
            </div>
            <div className="relative max-h-[230px] overflow-auto ps-[6px]">
              {card.scheduleMonths.map((mo, i) => (
                <div
                  key={i}
                  className="relative flex gap-[12px] pb-[9px] last:pb-0"
                >
                  {i < card.scheduleMonths.length - 1 ? (
                    <div className="absolute start-[4px] top-[11px] bottom-[-2px] w-[1.5px] bg-fp-border" />
                  ) : null}
                  <div
                    className="absolute start-0 top-[4px] h-[9px] w-[9px] rounded-full ring-[2.5px] ring-fp-surface"
                    style={{
                      background:
                        mo.muted && !mo.covered
                          ? 'var(--fp-border-strong)'
                          : status.main,
                    }}
                  />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-3 ps-[11px]">
                    <span
                      className={`text-[12px] ${mo.muted ? 'text-fp-text-3' : 'text-fp-text-2'}`}
                    >
                      {mo.label}
                      {mo.covered ? ' · covered' : ''}
                    </span>
                    <span
                      className={`text-[12px] tabular-nums ${mo.muted ? 'text-fp-text-3' : 'font-bold text-fp-text'}`}
                    >
                      {mo.amountStr}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}
