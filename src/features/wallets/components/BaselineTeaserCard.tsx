import { useGoals } from '#/features/goals/hooks/useGoals'

/** Ties these balances to the planning pages (Goals & Budget): once goals with a target
 *  exist, it shows real saved-toward-target progress; otherwise just the message. */
export function BaselineTeaserCard() {
  const { view } = useGoals()
  const pct = view.savedGoalsPct

  return (
    <div className="rounded-[18px] border border-dashed border-fp-border-strong bg-fp-accent-soft p-[18px]">
      <div className="mb-[6px] text-[13.5px] font-bold">
        Your baseline feeds planning
      </div>
      <div className="mb-[14px] text-[12.5px] leading-[1.5] text-fp-text-2">
        These balances become the live starting point for Goals &amp; Budget.
      </div>

      {pct !== null ? (
        <>
          <div className="mb-[6px] flex items-center justify-between text-[12px]">
            <span className="font-semibold">Saving goals</span>
            <span className="font-bold text-fp-text-2">
              {Math.round(pct * 100)}%
            </span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-[5px] bg-fp-surface">
            <div
              className="h-full rounded-[5px] bg-fp-accent"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
        </>
      ) : null}

      <div className="mt-[9px] text-[11px] text-fp-text-3">
        Preview · planning pages coming next
      </div>
    </div>
  )
}
