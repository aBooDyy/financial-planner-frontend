import { IconChip } from '#/components/icons/IconChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { MoveTarget } from '#/features/categories/data/moveTargets'
import { cn } from '#/lib/utils'

type Props = {
  targets: ReadonlyArray<MoveTarget>
  value: string | null
  onChange: (id: string) => void
}

/** The category a deleted one's rows move into — categories with their subcategories nested. */
export function MoveTargetSelect({ targets, value, onChange }: Props) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger aria-label="Move them to" className="w-full">
        <SelectValue placeholder="Choose a category" />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {targets.map((t) => (
          <SelectItem
            key={t.id}
            value={t.id}
            className={cn(t.parentName && 'ps-7')}
            textValue={t.label}
          >
            <IconChip
              id={t.icon}
              color={t.color}
              size={22}
              className="rounded-[6px]"
            />
            <span className={cn('truncate', !t.parentName && 'font-semibold')}>
              {t.parentName ? (
                // The list nests a subcategory under its parent; the trigger, showing it
                // alone, needs the parent's name to say which "Other" it is.
                <span className="text-fp-text-3 in-data-[slot=select-item]:hidden">
                  {t.parentName} ›{' '}
                </span>
              ) : null}
              {t.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
