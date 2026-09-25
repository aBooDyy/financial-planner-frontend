import { Check, Lock } from 'lucide-react'
import { Icon } from '#/components/icons/Icon'
import { iconTint } from '#/components/icons/IconChip'
import type { ResolvedCategory } from '#/features/categories/data/catalog'
import { cn } from '#/lib/utils'

type Props = {
  category: ResolvedCategory
  on: boolean
  required: boolean
  peekOpen: boolean
  onToggle: () => void
  onPeek: () => void
}

/**
 * A category pill. Selected, it takes the category's colour and offers a "+N" badge that
 * peeks at the subcategories it brings along. The badge is its own button beside the
 * toggle — one control can't sit inside another.
 */
export function CategoryChip({
  category,
  on,
  required,
  peekOpen,
  onToggle,
  onPeek,
}: Props) {
  const subCount = category.subs.length

  return (
    <div
      className={cn(
        'flex items-center rounded-full border-[1.5px] transition-colors',
        on
          ? 'text-fp-text'
          : 'border-fp-border bg-fp-surface text-fp-text-2 hover:border-fp-text-3',
      )}
      style={
        on
          ? {
              borderColor: category.color,
              background: iconTint(category.color),
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={required}
        aria-pressed={on}
        title={required ? 'Always included' : undefined}
        className={cn(
          'flex items-center gap-[7px] rounded-full py-2 ps-2.5 text-[13.5px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/25',
          required ? 'cursor-default' : 'cursor-pointer',
          on && subCount > 0 ? 'pe-1.5' : 'pe-[13px]',
        )}
      >
        <span
          className="flex"
          style={{ color: on ? category.color : 'var(--fp-text-3)' }}
        >
          <Icon id={category.icon} size={15} />
        </span>
        <span>{category.name}</span>
        {!(on && subCount > 0) && (
          <ChipMark on={on} required={required} color={category.color} />
        )}
      </button>
      {on && subCount > 0 && (
        <>
          <button
            type="button"
            onClick={onPeek}
            aria-expanded={peekOpen}
            aria-label={`See the ${subCount} subcategories of ${category.name}`}
            className="cursor-pointer rounded-full px-[7px] py-0.5 text-[11.5px] font-bold text-fp-text-2 hover:text-fp-text"
            style={{
              background: peekOpen
                ? `color-mix(in oklab, ${category.color} 20%, transparent)`
                : 'var(--fp-surface-2)',
            }}
          >
            +{subCount}
          </button>
          <span className="flex pe-[13px] ps-[7px]">
            <ChipMark on required={required} color={category.color} />
          </span>
        </>
      )}
    </div>
  )
}

function ChipMark({
  on,
  required,
  color,
}: {
  on: boolean
  required: boolean
  color: string
}) {
  if (!on) return null
  const Glyph = required ? Lock : Check
  return (
    <span aria-hidden className="flex" style={{ color }}>
      <Glyph size={13} strokeWidth={required ? 2.2 : 2.6} />
    </span>
  )
}
