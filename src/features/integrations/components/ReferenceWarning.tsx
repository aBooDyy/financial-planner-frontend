import { TriangleAlert } from 'lucide-react'

type Props = {
  onFix: () => void
  /** "Fix this" was pressed and the sample has no likely reference to point at. */
  noCandidates: boolean
}

/** A nudge, never a block: without a reference, identical payloads count once. */
export function ReferenceWarning({ onFix, noCandidates }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-fp-warn/40 bg-fp-surface px-3 py-2.5 text-[12.5px] text-fp-text-2">
      <TriangleAlert
        aria-hidden
        size={15}
        strokeWidth={2}
        className="mt-px shrink-0 text-fp-warn"
      />
      <div className="flex flex-col gap-1.5">
        <p>
          No “reference” field. Means will use a fingerprint of the payload to
          spot repeats — two identical transactions would be counted once.
        </p>
        {noCandidates ? (
          <p className="text-fp-text-3">
            Nothing in this sample looks like an id. Tap the value that is
            different for every transaction.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onFix}
          className="self-start font-semibold text-fp-accent-ink hover:underline"
        >
          Fix this
        </button>
      </div>
    </div>
  )
}
