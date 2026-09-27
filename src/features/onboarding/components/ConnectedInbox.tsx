import { Check } from 'lucide-react'

type Props = {
  email: string
  canUndo: boolean
  onUndo: () => void
}

export function ConnectedInbox({ email, canUndo, onUndo }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-fp-accent bg-fp-accent-soft px-4 py-3.5">
      <span className="flex size-[30px] flex-none items-center justify-center rounded-full bg-fp-accent text-white">
        <Check size={16} strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{email}</div>
        <div className="mt-px text-[13px] text-fp-text-2">
          Pick which bank alerts to read in Settings → Email sync.
        </div>
      </div>
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="cursor-pointer text-[13px] font-semibold text-fp-text-2 hover:text-fp-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        Undo
      </button>
    </div>
  )
}
