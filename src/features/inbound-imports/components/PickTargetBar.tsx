import { Chip, ChipRow } from '#/components/dialog/Chip'
import type { PickField } from '#/features/inbound-imports/data/pickValues'
import { PICK_FIELDS } from '#/features/inbound-imports/data/pickValues'

type Props = {
  target: PickField
  onTarget: (field: PickField) => void
}

/** Which review field a tapped payload value fills. */
export function PickTargetBar({ target, onTarget }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-bold text-fp-text-2">
        Tap a value to fill
      </span>
      <ChipRow label="Field to fill">
        {PICK_FIELDS.map(({ field, label }) => (
          <Chip
            key={field}
            active={field === target}
            onClick={() => onTarget(field)}
          >
            {label}
          </Chip>
        ))}
      </ChipRow>
    </div>
  )
}
