import type { GoalDetailView } from '#/features/goals/data/goalDetail'

type Props = {
  detail: GoalDetailView
  color: string
}

/** Settled progress (solid) and what waits on a confirm (striped), with its captions. */
export function GoalProgress({ detail, color }: Props) {
  const { bar } = detail
  const stripe = `repeating-linear-gradient(45deg, ${color}, ${color} 3px, color-mix(in srgb, ${color} 30%, transparent) 3px, color-mix(in srgb, ${color} 30%, transparent) 6px)`

  return (
    <div>
      {bar ? (
        <div className="flex items-center gap-[10px]">
          <div
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(bar.savedPct)}
            className="flex h-2 min-w-0 flex-1 gap-[2px] overflow-hidden rounded-[5px] bg-fp-surface-2"
          >
            {bar.savedPct > 0 ? (
              <div
                data-segment="settled"
                style={{ width: `${bar.savedPct}%`, background: color }}
              />
            ) : null}
            {bar.awaitingPct > 0 ? (
              <div
                data-segment="awaiting"
                style={{ width: `${bar.awaitingPct}%`, background: stripe }}
              />
            ) : null}
          </div>
          <span className="flex-none text-[13px] font-extrabold tabular-nums">
            {detail.pctStr}
          </span>
        </div>
      ) : null}
      <div className="mt-[6px] flex justify-between gap-3 text-[11.5px] text-fp-text-3 tabular-nums">
        <span>{detail.savedCaption}</span>
        {detail.leftCaption ? (
          <span className="whitespace-nowrap">{detail.leftCaption}</span>
        ) : null}
      </div>
    </div>
  )
}
