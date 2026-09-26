import { TriangleAlert } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'

type Props = {
  onFix: () => void
  /** "Fix this" was pressed and the sample has no likely reference to point at. */
  noCandidates: boolean
}

/** A nudge, never a block: without a reference, identical payloads count once. */
export function ReferenceWarning({ onFix, noCandidates }: Props) {
  return (
    <NoteBox tone="warn" icon={<TriangleAlert />}>
      <div className="flex flex-col gap-1.5">
        <p>
          No “reference” field. Means will use a fingerprint of the payload to
          spot repeats — two identical transactions would be counted once.
        </p>
        {noCandidates ? (
          <p className="font-medium">
            Nothing in this sample looks like an id. Tap the value that is
            different for every transaction.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onFix}
          className="self-start font-extrabold underline-offset-2 hover:underline"
        >
          Fix this
        </button>
      </div>
    </NoteBox>
  )
}
