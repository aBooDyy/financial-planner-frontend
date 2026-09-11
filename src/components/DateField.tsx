import { Calendar } from 'lucide-react'
import { formatDate, parseISODate } from '#/lib/date'
import type { DateFormat } from '#/lib/date'

type Props = {
  // Wire value, `YYYY-MM-DD` (or '' for none).
  value: string
  onChange: (iso: string) => void
  dateFormat: DateFormat
  invalid?: boolean
  ariaLabel?: string
  placeholder?: string
  className?: string
  // Appearance of the visible box (sizing/typography). Default is the standard form-field size;
  // override for a compact inline control.
  boxClassName?: string
  iconSize?: number
}

const BOX_BASE =
  'flex items-center justify-between gap-2 border bg-fp-surface-2 focus-within:shadow-[0_0_0_3px_var(--fp-accent-soft)]'
const BOX_DEFAULT = 'w-full rounded-[11px] px-3 py-[11px] text-[14px]'

/**
 * A date field that *displays* its value in the user's chosen format. A native `<input
 * type="date">` can't honor a custom format (the browser renders it in the OS locale), so the
 * native control is laid transparently over a styled box that shows `formatDate(value)` — the
 * picker stays native (incl. mobile), only the visible text follows the preference.
 */
export function DateField({
  value,
  onChange,
  dateFormat,
  invalid,
  ariaLabel,
  placeholder = 'Select a date',
  className = '',
  boxClassName = BOX_DEFAULT,
  iconSize = 16,
}: Props) {
  const parsed = value ? parseISODate(value) : null
  const display = parsed ? formatDate(parsed, dateFormat) : ''

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${BOX_BASE} ${boxClassName} ${
          invalid
            ? 'border-fp-danger'
            : 'border-fp-border-strong focus-within:border-fp-accent'
        }`}
      >
        <span
          className={display ? 'tabular-nums text-fp-text' : 'text-fp-text-3'}
        >
          {display || placeholder}
        </span>
        <Calendar
          size={iconSize}
          strokeWidth={1.9}
          className="shrink-0 text-fp-text-3"
        />
      </div>
      <input
        type="date"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker()
          } catch {
            // Unavailable on older browsers or blocked — the native click still opens it.
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  )
}
