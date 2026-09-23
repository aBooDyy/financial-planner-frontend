import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { cn } from '#/lib/utils'
import type { IconId } from '#/lib/icons/catalog.gen'

/** The chip's backdrop: the entity's own colour at 12%, so it tints in either theme. */
export const iconTint = (color: string) =>
  `color-mix(in oklab, ${color} 12%, transparent)`

type Props = {
  id: IconId
  /** The entity's colour — the icon is drawn in it and the square is tinted with it. */
  color: string
  /** Square size in px: ~36–40 in a row, 56 for an editor's icon trigger. */
  size?: number
  /** Glyph size in px; defaults to half the square. */
  iconSize?: number
  className?: string
  title?: string
}

/**
 * Both sizes travel as custom properties rather than inline width/height, so a caller can
 * shrink the chip at a breakpoint with an ordinary utility instead of fighting `!important`.
 */
const sizing = 'size-[var(--chip-size)] [&>svg]:size-[var(--chip-glyph-size)]'

/** An entity's icon on a tinted square — the badge every row and editor trigger shows. */
export function IconChip({
  id,
  color,
  size = 36,
  iconSize,
  className,
  title,
}: Props) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[10px]',
        sizing,
        className,
      )}
      style={
        {
          '--chip-size': `${size}px`,
          '--chip-glyph-size': `${iconSize ?? Math.round(size / 2)}px`,
          color,
          background: iconTint(color),
        } as CSSProperties
      }
    >
      <Icon id={id} size={iconSize ?? Math.round(size / 2)} title={title} />
    </span>
  )
}
