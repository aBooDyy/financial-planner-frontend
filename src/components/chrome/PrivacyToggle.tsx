import { Eye, EyeClosed } from 'lucide-react'
import { usePrivacyStore } from '#/stores/privacy'

const BASE =
  'relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border transition-colors'
const OFF = 'border-fp-border bg-fp-surface text-fp-text-2 hover:text-fp-text'
const ON = 'border-fp-accent bg-fp-accent-soft text-fp-accent-ink'

const GLYPH = 'absolute transition-[opacity,transform] duration-200 ease-out'
const SHOWN = 'opacity-100 scale-100'
const GONE = 'opacity-0 scale-75'

export function PrivacyToggle() {
  const hidden = usePrivacyStore((s) => s.hidden)
  const toggle = usePrivacyStore((s) => s.toggle)
  const label = hidden ? 'Show amounts' : 'Hide amounts'

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={hidden}
      className={`${BASE} ${hidden ? ON : OFF}`}
    >
      <Eye
        size={18}
        strokeWidth={1.9}
        aria-hidden
        className={`${GLYPH} ${hidden ? GONE : SHOWN}`}
      />
      <EyeClosed
        size={18}
        strokeWidth={1.9}
        aria-hidden
        className={`${GLYPH} ${hidden ? SHOWN : GONE}`}
      />
    </button>
  )
}
