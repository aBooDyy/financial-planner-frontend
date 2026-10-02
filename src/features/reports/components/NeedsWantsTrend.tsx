import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '#/components/ui/tooltip'
import type { NwsMonth } from '#/features/reports/data/needsWantsCard'
import { cn } from '#/lib/utils'
import { SEGMENT_FILL } from './needsWantsFills'

type Props = { months: NwsMonth[] }

/** Each month's split as a 100% column, oldest first. */
export function NeedsWantsTrend({ months }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-bold text-fp-text-2">By month</span>
      <ul className="flex items-end gap-[6px]">
        {months.map((m) => (
          <li
            key={m.key}
            className="flex min-w-0 flex-1 flex-col items-center gap-[5px]"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={m.title}
                  className="flex h-[64px] w-full max-w-[30px] flex-col-reverse gap-[2px] overflow-hidden rounded-[6px] bg-fp-surface-2 outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/30"
                >
                  {m.segments.map((s) => (
                    <span
                      key={s.key}
                      className={cn('w-full flex-none', SEGMENT_FILL[s.key])}
                      style={{ height: `${s.widthPct}%` }}
                    />
                  ))}
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6} className="px-[10px] py-[7px]">
                <span className="text-[12px] font-semibold">{m.title}</span>
              </TooltipContent>
            </Tooltip>
            <span className="text-[11px] font-semibold whitespace-nowrap text-fp-text-3">
              {m.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
