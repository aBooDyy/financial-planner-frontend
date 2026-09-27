import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { ChevronDown } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '#/components/ui/popover'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { TxType } from '#/features/transactions/api/types'
import { cn } from '#/lib/utils'
import { CategoryOptions } from './CategoryOptions'
import { FIELD_WELL } from '#/components/ui/field-well'

type Props = {
  /** Only this type's categories are offered. */
  type: TxType
  /** The picked leaf: a subcategory's id, or a category's; null only with `none`. */
  categoryId: string | null
  onChange: (categoryId: string) => void
  /** Offers "no category" as the first row, e.g. "Decide when reviewing". */
  none?: { label: string; onPick: () => void }
  id?: string
  invalid?: boolean
  label?: string
  className?: string
  align?: 'start' | 'center' | 'end'
  /** Opens the list from this element instead of the full-width field, e.g. a chip. */
  trigger?: ReactElement
}

const TRIGGER = cn(
  FIELD_WELL,
  'flex w-full cursor-pointer items-center gap-[10px] px-[10px] py-[7px] text-start data-[state=open]:border-fp-accent',
)

/** A searchable pick of a category or one of its subcategories, shown as "Parent › Sub". */
export function CategoryPicker({
  type,
  categoryId,
  onChange,
  none,
  id,
  invalid,
  label = 'Category',
  className,
  align = 'start',
  trigger,
}: Props) {
  const [open, setOpen] = useState(false)
  const catalog = useCategoryCatalog()
  const empty = categoryId === null && none !== undefined
  const parent = catalog.rootOf(categoryId ?? '')
  const picked = catalog.get(categoryId ?? '')
  const sub = picked.parentId === null ? null : picked

  // Built only while open: a closed picker must not pay for the whole tree.
  const categories = useMemo(
    () => (open ? catalog.byType(type) : []),
    [open, catalog, type],
  )

  const pick = (next: string) => {
    onChange(next)
    setOpen(false)
  }
  const pickNone = none
    ? () => {
        none.onPick()
        setOpen(false)
      }
    : undefined
  const shown = empty
    ? none.label
    : sub
      ? `${parent.name} › ${sub.name}`
      : parent.name

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {trigger ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : (
        <PopoverTrigger
          id={id}
          aria-label={`${label}: ${shown}`}
          aria-invalid={invalid ? true : undefined}
          className={cn(TRIGGER, className)}
        >
          {empty ? null : (
            <IconChip
              id={sub?.icon ?? parent.icon}
              color={sub?.color ?? parent.color}
              size={30}
              iconSize={16}
              className="rounded-[9px]"
            />
          )}
          <span className="flex min-w-0 flex-1 items-baseline gap-[5px] truncate text-[13.5px]">
            {empty ? (
              <span className="truncate py-[6px] text-[14px] font-semibold">
                {shown}
              </span>
            ) : sub ? (
              <>
                <span className="truncate font-medium text-fp-text-2">
                  {parent.name}
                </span>
                <span aria-hidden className="text-fp-text-3">
                  ›
                </span>
                <span className="truncate font-semibold">{sub.name}</span>
              </>
            ) : (
              <span className="truncate font-semibold">{parent.name}</span>
            )}
          </span>
          <ChevronDown size={16} className="shrink-0 text-fp-text-3" />
        </PopoverTrigger>
      )}
      <PopoverContent
        align={align}
        className="w-[max(var(--radix-popover-trigger-width),min(320px,calc(100vw-32px)))] p-0"
      >
        {open ? (
          <CategoryOptions
            categories={categories}
            value={categoryId ?? ''}
            onPick={pick}
            none={
              none && pickNone
                ? { label: none.label, onPick: pickNone }
                : undefined
            }
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
