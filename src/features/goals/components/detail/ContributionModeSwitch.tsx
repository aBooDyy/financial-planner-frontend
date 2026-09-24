import type { ContributionMode } from '#/features/goals/data/contribution'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'

const MODES: { value: ContributionMode; label: string }[] = [
  { value: 'now', label: 'Paid now' },
  { value: 'later', label: 'Plan for later' },
]

type Props = {
  value: ContributionMode
  onChange: (mode: ContributionMode) => void
}

/** Full-width "Paid now | Plan for later" segmented control. */
export function ContributionModeSwitch({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as ContributionMode)
      }}
      spacing={0.5}
      className="flex w-full rounded-[10px] border border-fp-border bg-fp-surface-2 p-[3px]"
    >
      {MODES.map((m) => (
        <ToggleGroupItem
          key={m.value}
          value={m.value}
          className="h-auto flex-1 rounded-[8px] py-[7px] text-[12.5px] font-bold text-fp-text-2 hover:bg-transparent hover:text-fp-text data-[state=on]:bg-fp-surface data-[state=on]:text-fp-text data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
        >
          {m.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
