import { ChevronDownIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type { SpendClass } from '#/features/categories/api/types'
import {
  SPEND_CLASSES,
  SPEND_CLASS_FILL,
  SPEND_CLASS_LABEL,
  UNSORTED_FILL,
  UNSORTED_LABEL,
} from '#/features/categories/spendClass'
import { cn } from '#/lib/utils'

const NONE = 'none'

type Props = {
  categoryName: string
  /** The row's own tag. */
  value: SpendClass | null
  /** A subcategory's root: what an untagged one inherits. Absent for a root. */
  inherits?: { name: string; value: SpendClass | null }
  onChange: (value: SpendClass | null) => void
}

const labelOf = (c: SpendClass | null) =>
  c ? SPEND_CLASS_LABEL[c] : UNSORTED_LABEL

/** Needs · Wants · Savings on one spending category; a subcategory may follow its root. */
export function SpendClassChip({
  categoryName,
  value,
  inherits,
  onChange,
}: Props) {
  const shown = value ?? inherits?.value ?? null
  const from = value === null ? inherits : undefined
  const noneLabel = inherits
    ? `Same as ${inherits.name} · ${labelOf(inherits.value)}`
    : UNSORTED_LABEL

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${categoryName}: ${labelOf(shown)}${from ? `, from ${from.name}` : ''}. Change`}
        title={from ? `From ${from.name}` : undefined}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center gap-[6px] rounded-full border px-[9px] py-[3px] text-[12px] font-bold outline-none focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/30',
          from || shown === null
            ? 'border-dashed border-fp-border-strong text-fp-text-3'
            : 'border-fp-border bg-fp-surface-2 text-fp-text-2',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-[7px] flex-none rounded-full',
            shown ? SPEND_CLASS_FILL[shown] : UNSORTED_FILL,
          )}
        />
        {labelOf(shown)}
        <ChevronDownIcon
          aria-hidden
          className="size-3 flex-none text-fp-text-3"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuRadioGroup value={value ?? NONE}>
          {SPEND_CLASSES.map((c) => (
            <DropdownMenuRadioItem
              key={c}
              value={c}
              onSelect={() => onChange(c)}
            >
              <span
                aria-hidden
                className={cn(
                  'size-2 flex-none rounded-full',
                  SPEND_CLASS_FILL[c],
                )}
              />
              {SPEND_CLASS_LABEL[c]}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={NONE} onSelect={() => onChange(null)}>
            {noneLabel}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
