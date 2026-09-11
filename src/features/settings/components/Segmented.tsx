import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

/** The segmented control used in Preferences (appearance, number format, week start). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: Props<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T)
      }}
      spacing={0.5}
      className="shrink-0 rounded-[11px] border border-fp-border bg-fp-surface-2 p-[3px]"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-auto rounded-[9px] px-[13px] py-[7px] text-[13px] font-semibold text-fp-text-2 hover:bg-transparent hover:text-fp-text data-[state=on]:bg-fp-surface data-[state=on]:font-bold data-[state=on]:text-fp-text data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
