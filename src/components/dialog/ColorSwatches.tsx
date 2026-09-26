import { Check } from 'lucide-react'

type Props = {
  label: string
  colors: ReadonlyArray<string>
  value: string
  onChange: (color: string) => void
}

/** The colour row every editor shares; the chosen swatch is ringed and ticked. */
export function ColorSwatches({ label, colors, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((color) => {
        const active = color.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Colour ${color}`}
            onClick={() => onChange(color)}
            className="flex size-7 items-center justify-center rounded-[9px] text-white transition hover:scale-105"
            style={{
              background: color,
              boxShadow: active
                ? `0 0 0 2px var(--fp-surface), 0 0 0 4px ${color}`
                : undefined,
            }}
          >
            {active ? <Check size={15} strokeWidth={3} /> : null}
          </button>
        )
      })}
    </div>
  )
}
