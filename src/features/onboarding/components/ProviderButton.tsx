import { Loader2, Mail } from 'lucide-react'

type Props = {
  label: string
  /** The provider's brand colour, behind the mail glyph. */
  color: string
  note?: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}

export function ProviderButton({
  label,
  color,
  note,
  busy,
  disabled,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-fp-border-strong bg-fp-surface px-4 py-3.5 text-[15px] font-semibold text-fp-text transition-colors hover:border-fp-text-3 hover:bg-fp-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className="flex size-[30px] items-center justify-center rounded-lg text-white"
        style={{ background: color }}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Mail size={16} strokeWidth={2} />
        )}
      </span>
      <span className="flex-1 text-start">{label}</span>
      {note && <span className="text-[13px] text-fp-text-3">{note}</span>}
    </button>
  )
}
