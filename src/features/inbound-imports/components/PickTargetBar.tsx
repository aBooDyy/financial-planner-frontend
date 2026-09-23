import { cn } from '#/lib/utils'
import type { PickField } from '#/features/inbound-imports/data/pickValues'
import { PICK_FIELDS } from '#/features/inbound-imports/data/pickValues'

type Props = {
  target: PickField
  onTarget: (field: PickField) => void
}

/** Which review field a tapped payload value fills. */
export function PickTargetBar({ target, onTarget }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      <span className="text-[11.5px] font-semibold text-fp-text-3">
        Tap a value to fill
      </span>
      <div
        role="group"
        aria-label="Field to fill"
        className="flex flex-wrap gap-[5px]"
      >
        {PICK_FIELDS.map(({ field, label }) => (
          <button
            key={field}
            type="button"
            aria-pressed={field === target}
            onClick={() => onTarget(field)}
            className={cn(
              'rounded-full border px-[9px] py-[3px] text-[11.5px] font-bold',
              field === target
                ? 'border-fp-accent bg-fp-accent-soft text-fp-accent-ink'
                : 'border-fp-border bg-fp-surface text-fp-text-2 hover:border-fp-border-strong',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
