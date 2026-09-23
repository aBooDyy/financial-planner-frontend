import { STATUS_COLORS } from '#/features/goals/constants'
import type { GoalsView } from '#/features/goals/data/selectors'

type Props = { view: GoalsView }

export function TimelineCard({ view }: Props) {
  return (
    <div className="rounded-[16px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      {view.timelineEmpty ? (
        <div className="py-[6px] text-[12.5px] text-fp-text-3">
          Add a goal or obligation with a date to see it here.
        </div>
      ) : (
        <div className="relative max-h-[420px] overflow-auto ps-[6px]">
          {view.timeline.map((t) => {
            const color = STATUS_COLORS[t.status].main
            return (
              <div key={t.id} className="relative flex pb-4">
                {!t.last ? (
                  <div className="absolute start-[5px] top-[10px] bottom-[-6px] w-[1.5px] bg-fp-border" />
                ) : null}
                <div
                  className="absolute start-0 top-[3px] z-[1] h-[11px] w-[11px] rounded-full ring-[3px] ring-fp-surface"
                  style={{ background: color }}
                />
                <div className="min-w-0 flex-1 ps-[22px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold tabular-nums">
                      {t.dateStr}
                    </span>
                    <span className="text-[11.5px] text-fp-text-3">
                      {t.relStr}
                    </span>
                  </div>
                  <div className="mt-px text-[13px] text-fp-text">{t.name}</div>
                  {t.hasNote ? (
                    <div
                      className="mt-[2px] text-[11px] font-semibold"
                      style={{ color: STATUS_COLORS.amber.main }}
                    >
                      {t.note}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
