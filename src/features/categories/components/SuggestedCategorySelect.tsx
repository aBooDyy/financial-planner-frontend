import { IconChip } from '#/components/icons/IconChip'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type {
  CatalogEntry,
  CategoryCatalog,
} from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'

const NONE = '__none__'

type Props = {
  id: string
  type: TxType
  catalog: CategoryCatalog
  /** A root's or a child's id; null leaves the choice to whoever reviews the import. */
  value: string | null
  onChange: (categoryId: string | null) => void
  noneLabel?: string
  invalid?: boolean
}

function EntryLabel({ entry }: { entry: CatalogEntry }) {
  return (
    <>
      <IconChip
        id={entry.icon}
        color={entry.color}
        size={22}
        iconSize={12}
        className="rounded-[7px]"
      />
      <span className="truncate">{entry.name}</span>
    </>
  )
}

/**
 * The category a source files what it stages under, by id: any root of `type` or one of its
 * children, or nothing. One select, children indented under their parent.
 */
export function SuggestedCategorySelect({
  id,
  type,
  catalog,
  value,
  onChange,
  noneLabel = 'Decide when reviewing',
  invalid,
}: Props) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid ? true : undefined}
      >
        <SelectValue>
          {value === null ? noneLabel : catalog.labelOf(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {catalog.byType(type).map((root) => (
          <SelectGroup key={root.id}>
            <SelectItem value={root.id}>
              <EntryLabel entry={root} />
            </SelectItem>
            {root.subs.map((sub) => (
              <SelectItem key={sub.id} value={sub.id} className="ps-8">
                <EntryLabel entry={sub} />
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
