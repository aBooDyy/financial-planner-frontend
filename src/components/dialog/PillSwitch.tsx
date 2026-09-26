import { cn } from '#/lib/utils'

export type PillOption<T extends string> = {
  value: T
  label: string
  disabled?: boolean
  title?: string
}

type Props<T extends string> = {
  label: string
  options: ReadonlyArray<PillOption<T>>
  value: T
  onChange: (value: T) => void
  /** The chosen pill's ink; the accent's when omitted. */
  color?: string
}

/** A two-to-four way switch in a pill track ("Paid now · Plan for later"). */
export function PillSwitch<T extends string>({
  label,
  options,
  value,
  onChange,
  color = 'var(--fp-accent-ink)',
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-fp-surface-2 p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => {
              if (!active) onChange(o.value)
            }}
            className={cn(
              'truncate rounded-full px-[6px] py-[9px] text-[13.5px] transition disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? 'bg-fp-surface font-extrabold shadow-[0_1px_3px_rgba(20,18,12,0.10),0_0_0_1px_var(--fp-border)]'
                : 'font-semibold text-fp-text-2 hover:text-fp-text',
            )}
            style={active ? { color } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
