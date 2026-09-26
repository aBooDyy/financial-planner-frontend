import { Inbox } from 'lucide-react'

type Props = {
  count: number
  onClick: () => void
}

export function PendingReviewButton({ count, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Review auto-logged transactions"
      className="inline-flex items-center gap-2 rounded-[11px] border border-fp-accent bg-fp-accent-soft px-[13px] py-[9px] text-[13px] font-bold text-fp-accent-ink"
    >
      <Inbox size={15} strokeWidth={2} />
      Review
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fp-accent px-1.5 text-[11px] font-bold text-white">
        {count}
      </span>
    </button>
  )
}
