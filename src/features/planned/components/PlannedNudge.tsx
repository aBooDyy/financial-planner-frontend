/** Activity's one-line pointer to Planning › Upcoming when something waits to be confirmed. */
export function PlannedNudge({
  count,
  onReview,
}: {
  count: number
  onReview: () => void
}) {
  return (
    <button
      type="button"
      onClick={onReview}
      className="flex w-full items-center gap-2 rounded-[13px] border border-fp-warn-line bg-fp-warn-soft px-[14px] py-[10px] text-start text-[13px] text-fp-warn"
    >
      <span
        aria-hidden
        className="size-[7px] flex-none rounded-full bg-fp-warn-fill"
      />
      <span className="min-w-0 flex-1 font-semibold">
        {count} waiting for you to confirm
      </span>
      <span className="flex-none font-bold">
        Review <span className="inline-block rtl:-scale-x-100">→</span>
      </span>
    </button>
  )
}
