import type { GoalDetailView } from '#/features/goals/data/goalDetail'

type Props = {
  detail: GoalDetailView
  color: string
}

/** Settled progress (solid) and what waits on a confirm (striped), with its captions. */
export function GoalProgress({ detail, color }: Props) {
  const { bar } = detail
  const light = `color-mix(in srgb, ${color} 45%, var(--fp-surface))`
  const stripe = `repeating-linear-gradient(135deg, ${color} 0 4px, ${light} 4px 8px)`
  const [lead, ...rest] = detail.savedCaption.split(' · ')

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
            className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-fp-surface-2"
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
      <div className="mt-2 flex justify-between gap-2 text-[12px] leading-[1.4] tabular-nums">
        <span>
          <b className="font-bold text-fp-text">{lead}</b>
          {rest.length > 0 ? (
            <span className="text-fp-text-2"> · {rest.join(' · ')}</span>
          ) : null}
        </span>
        {detail.leftCaption ? (
          <span className="whitespace-nowrap text-fp-text-2">
            {detail.leftCaption}
          </span>
        ) : null}
      </div>
    </div>
  )
}
