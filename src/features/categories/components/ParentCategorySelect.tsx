import { IconChip } from '#/components/icons/IconChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { ResolvedCategory } from '#/features/categories/data/catalog'

type Props = {
  id?: string
  /** The chosen parent's id; `null` for a category of its own. */
  value: string | null
  options: ReadonlyArray<ResolvedCategory>
  /** The first option, which files it at the top level. */
  noneLabel: string
  onChange: (parent: ResolvedCategory | null) => void
}

const NONE = '__top__'

/** Where a new category goes: at the top level, or inside one of these as a subcategory. */
export function ParentCategorySelect({
  id,
  value,
  options,
  noneLabel,
  onChange,
}: Props) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) =>
        onChange(
          next === NONE ? null : (options.find((c) => c.id === next) ?? null),
        )
      }
    >
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {options.map((c) => (
          <SelectItem key={c.id} value={c.id} textValue={c.name}>
            <IconChip
              id={c.icon}
              color={c.color}
              size={22}
              iconSize={13}
              className="rounded-[7px]"
            />
            <span className="truncate">{c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
