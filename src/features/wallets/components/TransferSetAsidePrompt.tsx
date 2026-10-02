import { ArrowLeft, Tag } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import { Button } from '#/components/ui/button'

type Props = {
  /** "SR 400.00 of this is set aside (…). Move those set-asides with it?" */
  text: string
  fromName: string
  toName: string
  busy: boolean
  onMove: () => void
  onLeave: () => void
  onBack: () => void
}

/**
 * Moving more than a wallet's Free to spend (03 §6): the set-asides it holds can follow the
 * money to the other wallet, or stay behind — leaving the source over-committed.
 */
export function TransferSetAsidePrompt({
  text,
  fromName,
  toName,
  busy,
  onMove,
  onLeave,
  onBack,
}: Props) {
  return (
    <div className="flex flex-col gap-[14px]">
      <NoteBox tone="warn" icon={<Tag />}>
        {text}
      </NoteBox>
      <ul className="flex flex-col gap-[6px] text-[12.5px] text-fp-text-2">
        <li>
          <span className="font-bold text-fp-text">Move them</span> — they stay
          set aside, now in {toName}.
        </li>
        <li>
          <span className="font-bold text-fp-text">Leave them</span> —{' '}
          {fromName} keeps them and shows how far it is over-committed.
        </li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button disabled={busy} onClick={onMove} className="flex-1 py-[11px]">
          Move them
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={onLeave}
          className="flex-1 py-[11px]"
        >
          Leave them
        </Button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-[12.5px] font-semibold text-fp-text-3 hover:text-fp-text"
      >
        <ArrowLeft size={14} aria-hidden className="rtl:-scale-x-100" />
        Change the amount
      </button>
    </div>
  )
}
