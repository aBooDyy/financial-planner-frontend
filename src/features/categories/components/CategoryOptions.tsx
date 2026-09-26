import {
  useDeferredValue,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Check } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import type { ResolvedCategory } from '#/features/categories/data/catalog'
import {
  pickerSections,
  pickerValue,
} from '#/features/categories/data/pickerSections'
import type { PickerSection } from '#/features/categories/data/pickerSections'
import type { IconId } from '#/lib/icons/catalog.gen'
import { cn } from '#/lib/utils'

type Props = {
  categories: ReadonlyArray<ResolvedCategory>
  category: string
  subcategory: string | null
  onPick: (category: string, subcategory: string | null) => void
  listClassName?: string
}

type RowProps = {
  value: string
  name: string
  icon: IconId
  color: string
  checked: boolean
  child: boolean
  onSelect: () => void
}

function OptionRow({
  value,
  name,
  icon,
  color,
  checked,
  child,
  onSelect,
}: RowProps) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      data-checked={checked}
      className={cn(
        child ? 'gap-[9px] py-[6px]' : 'gap-[10px] py-[7px]',
        checked && 'text-fp-accent-ink',
      )}
    >
      <IconChip
        id={icon}
        color={color}
        size={child ? 22 : 28}
        iconSize={child ? 12 : 15}
        className={child ? 'rounded-[6px]' : 'rounded-[8px]'}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          child ? 'text-[13px]' : 'text-[13.5px] font-semibold',
          child && !checked && 'text-fp-text-2',
          checked && 'font-bold',
        )}
      >
        {name}
      </span>
      {checked ? (
        <Check
          size={15}
          strokeWidth={2.4}
          className="shrink-0 text-fp-accent-ink"
        />
      ) : null}
    </CommandItem>
  )
}

type SectionProps = {
  section: PickerSection
  category: string
  subcategory: string | null
  onPick: (category: string, subcategory: string | null) => void
}

function OptionSection({
  section: { parent, subs },
  category,
  subcategory,
  onPick,
}: SectionProps) {
  const inThis = category === parent.slug
  return (
    <CommandGroup className="py-0.5">
      <OptionRow
        value={pickerValue(parent.slug, null)}
        name={parent.name}
        icon={parent.icon}
        color={parent.color}
        checked={inThis && subcategory === null}
        child={false}
        onSelect={() => onPick(parent.slug, null)}
      />
      {subs.length > 0 ? (
        // The rail sits under the parent's chip, so the children read as inside it.
        <div className="ms-[21px] border-s border-fp-border ps-[6px]">
          {subs.map((sub) => (
            <OptionRow
              key={sub.slug}
              value={pickerValue(parent.slug, sub.slug)}
              name={sub.name}
              icon={sub.icon}
              color={sub.color}
              checked={inThis && subcategory === sub.slug}
              child
              onSelect={() => onPick(parent.slug, sub.slug)}
            />
          ))}
        </div>
      ) : null}
    </CommandGroup>
  )
}

/**
 * The searchable two-level list: each parent is a pickable row with its children indented
 * beneath it. Matched by hand (`shouldFilter={false}`) so a parent's name finds its children.
 */
export function CategoryOptions({
  categories,
  category,
  subcategory,
  onPick,
  listClassName,
}: Props) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const sections = useMemo(
    () => pickerSections(categories, deferredQuery),
    [categories, deferredQuery],
  )

  const first = sections[0] ? pickerValue(sections[0].parent.slug, null) : ''
  const [active, setActive] = useState(() => pickerValue(category, subcategory))
  const [shown, setShown] = useState(sections)
  if (shown !== sections) {
    setShown(sections)
    setActive(first)
  }

  const listRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    listRef.current
      ?.querySelector('[data-checked="true"]')
      ?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <Command shouldFilter={false} value={active} onValueChange={setActive}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search categories…"
      />
      <CommandList
        ref={listRef}
        className={cn('max-h-[min(360px,55vh)] py-1', listClassName)}
      >
        <CommandEmpty>No category matches.</CommandEmpty>
        {sections.map((section) => (
          <OptionSection
            key={section.parent.slug}
            section={section}
            category={category}
            subcategory={subcategory}
            onPick={onPick}
          />
        ))}
      </CommandList>
    </Command>
  )
}
