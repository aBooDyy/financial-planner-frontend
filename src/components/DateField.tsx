import { Calendar } from 'lucide-react'
import { formatDate, parseISODate, relativeDayLabel } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { cn } from '#/lib/utils'

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
  /**
   * The quiet word at the end of the well in place of the calendar icon: `true` shows how far
   * away the date is ("in 5d", "12 days ago"), a string shows itself ("past due").
   */
  hint?: boolean | string
}

const BOX_BASE =
  'flex items-center justify-between gap-[10px] border-[1.5px] bg-fp-surface-2 focus-within:shadow-[0_0_0_3px_var(--fp-accent-soft)]'
const BOX_DEFAULT =
  'w-full rounded-[14px] px-[14px] py-3 text-[14px] font-semibold'

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
  hint,
}: Props) {
  const parsed = value ? parseISODate(value) : null
  const display = parsed ? formatDate(parsed, dateFormat) : ''
  const hintText =
    typeof hint === 'string'
      ? hint
      : hint && value
        ? relativeDayLabel(value)
        : null

  return (
    <div className={`relative ${className}`}>
      <div
        className={cn(
          BOX_BASE,
          boxClassName,
          invalid
            ? 'border-fp-danger bg-fp-danger/[0.07]'
            : 'border-fp-border focus-within:border-fp-accent',
        )}
      >
        <span
          className={
            display
              ? 'truncate text-fp-text tabular-nums'
              : 'truncate font-medium text-fp-text-3'
          }
        >
          {display || placeholder}
        </span>
        {hintText ? (
          <span
            className={cn(
              'flex-none text-[12px] font-bold whitespace-nowrap',
              invalid ? 'text-fp-danger' : 'text-fp-text-3',
            )}
          >
            {hintText}
          </span>
        ) : (
          <Calendar
            size={iconSize}
            strokeWidth={1.9}
            className="shrink-0 text-fp-text-3"
          />
        )}
      </div>
      <input
        type="date"
        value={value}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
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
