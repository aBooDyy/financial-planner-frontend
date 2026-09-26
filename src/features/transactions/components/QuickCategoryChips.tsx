import { MoreHorizontal } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Icon } from '#/components/icons/Icon'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'
import type { QuickChip } from '#/features/transactions/data/quickChips'
import type { IconId } from '#/lib/icons/catalog.gen'

type Props = {
  type: TxType
  chips: ReadonlyArray<QuickChip>
  category: string
  subcategory: string | null
  onChange: (category: string, subcategory: string | null) => void
}

const CHIP =
  'inline-flex max-w-full items-center gap-[6px] whitespace-nowrap rounded-full border px-[11px] py-[7px] text-[12px] font-semibold transition'

const IDLE =
  'border-fp-border bg-fp-surface-2 text-fp-text-2 hover:border-fp-border-strong hover:text-fp-text'

/** A chosen chip wears its category's own colour: border, tint and ink. */
const activeStyle = (color: string): CSSProperties => ({
  borderColor: color,
  background: `color-mix(in oklab, ${color} 12%, transparent)`,
  color,
})

type Face = { icon: IconId; color: string; name: string; full: string }

/**
 * Quick add's categories: the few the user reaches for most, one tap each, and **More** for
 * the whole searchable tree. A pick from the tree takes More's place so it stays visible.
 */
export function QuickCategoryChips({
  type,
  chips,
  category,
  subcategory,
  onChange,
}: Props) {
  const catalog = useCategoryCatalog()

  const faceOf = (slug: string, subSlug: string | null): Face => {
    const parent = catalog.get(slug)
    const sub = catalog.sub(slug, subSlug)
    return {
      icon: sub?.icon ?? parent.icon,
      color: sub?.color ?? parent.color,
      name: sub?.name ?? parent.name,
      full: catalog.labelOf(slug, sub?.slug ?? null),
    }
  }

  const isChosen = (slug: string, subSlug: string | null) =>
    slug === category && subSlug === subcategory
  const chosenInChips = chips.some((c) => isChosen(c.category, c.subcategory))
  const chosen = faceOf(category, subcategory)

  return (
    <div
      role="group"
      aria-label="Category"
      className="flex flex-wrap gap-[6px]"
    >
      {chips.map((chip) => {
        const face = faceOf(chip.category, chip.subcategory)
        const active = isChosen(chip.category, chip.subcategory)
        return (
          <button
            key={`${chip.category}/${chip.subcategory ?? ''}`}
            type="button"
            title={face.full}
            aria-pressed={active}
            onClick={() => onChange(chip.category, chip.subcategory)}
            className={`${CHIP} ${active ? '' : IDLE}`}
            style={active ? activeStyle(face.color) : undefined}
          >
            <Icon id={face.icon} size={15} />
            <span className="truncate">{face.name}</span>
          </button>
        )
      })}

      <CategoryPicker
        type={type}
        category={category}
        subcategory={subcategory}
        onChange={onChange}
        trigger={
          <button
            type="button"
            title={chosenInChips ? 'More categories' : chosen.full}
            aria-label={
              chosenInChips ? 'More categories' : `Category: ${chosen.full}`
            }
            className={`${CHIP} ${chosenInChips ? IDLE : ''}`}
            style={chosenInChips ? undefined : activeStyle(chosen.color)}
          >
            {chosenInChips ? (
              <MoreHorizontal size={15} strokeWidth={1.9} />
            ) : (
              <Icon id={chosen.icon} size={15} />
            )}
            <span className="truncate">
              {chosenInChips ? 'More' : chosen.full}
            </span>
          </button>
        }
      />
    </div>
  )
}
