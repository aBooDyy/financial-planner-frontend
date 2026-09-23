import { useIconPaths } from './useIconPaths'
import type { IconId } from '#/lib/icons/catalog.gen'

type Props = {
  id: IconId
  size?: number
  className?: string
  /** Give a title only when the icon carries meaning no adjacent text already carries. */
  title?: string
}

/**
 * A content icon (a category's, a wallet's, a group's), drawn from the lazily loaded path
 * table. It takes its colour from CSS `color`, and renders the same in both directions — a
 * pictogram of a thing is not a directional affordance.
 */
export function Icon({ id, size = 20, className, title }: Props) {
  const paths = useIconPaths()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
      focusable="false"
      role={title === undefined ? undefined : 'img'}
      aria-hidden={title === undefined ? true : undefined}
    >
      {title === undefined ? null : <title>{title}</title>}
      {/* Sized and empty until the chunk lands, so the glyph appears without reflowing. */}
      {paths === null ? null : <path d={paths[id]} />}
    </svg>
  )
}
