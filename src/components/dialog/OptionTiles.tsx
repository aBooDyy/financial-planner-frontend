import { cn } from '#/lib/utils'

export type TileOption<T extends string> = {
  value: T
  label: string
  description?: string
}

type Props<T extends string> = {
  label: string
  options: ReadonlyArray<TileOption<T>>
  value: T
  onChange: (value: T) => void
  columns?: 2 | 3
  /** The chosen tile's colour; the accent when omitted. */
  color?: string
}

/** Choices that each need a line of explanation ("Bill — something you have to pay"). */
export function OptionTiles<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
  color = 'var(--fp-accent)',
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid gap-2',
        columns === 3 ? 'grid-cols-3' : 'grid-cols-2',
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-w-0 rounded-[12px] border-[1.5px] px-3 py-[10px] text-start transition',
              !active &&
                'border-fp-border bg-fp-surface hover:border-fp-border-strong',
            )}
            style={
              active
                ? {
                    borderColor: color,
                    background: `color-mix(in srgb, ${color} 10%, var(--fp-surface))`,
                  }
                : undefined
            }
          >
            <div
              className="text-[13px] font-extrabold text-fp-text"
              style={
                active
                  ? {
                      color: `color-mix(in srgb, ${color} 70%, var(--fp-text))`,
                    }
                  : undefined
              }
            >
              {o.label}
            </div>
            {o.description ? (
              <div className="mt-[2px] text-[11.5px] leading-[1.4] text-fp-text-3">
                {o.description}
              </div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
