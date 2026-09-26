import { ColorSwatches } from '#/components/dialog/ColorSwatches'
import { FieldLabel } from '#/components/FieldLabel'
import { GOAL_COLORS } from '#/features/goals/constants'

type Props = {
  value: string
  onChange: (color: string) => void
}

export function ColourField({ value, onChange }: Props) {
  return (
    <div>
      <FieldLabel>Colour</FieldLabel>
      <ColorSwatches
        label="Colour"
        colors={GOAL_COLORS}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
