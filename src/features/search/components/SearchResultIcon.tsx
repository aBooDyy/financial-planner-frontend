import { IconChip, iconTint } from '#/components/icons/IconChip'
import { TransferGlyph } from '#/components/icons/TransferGlyph'
import { isIconId } from '#/lib/icons/catalog.gen'
import type { SearchResultRow } from '#/features/search/data/types'

const TILE =
  'flex size-9 flex-none items-center justify-center rounded-[10px] text-[14px] font-extrabold'

/** A result's 36px tinted tile: its icon, the transfer mark, or its title's first letter. */
export function SearchResultIcon({
  row,
}: {
  row: Pick<SearchResultRow, 'color' | 'iconId' | 'title' | 'transfer'>
}) {
  if (!row.transfer && isIconId(row.iconId))
    return (
      <IconChip id={row.iconId} color={row.color} size={36} iconSize={17} />
    )

  return (
    <span
      aria-hidden
      className={TILE}
      style={{ color: row.color, background: iconTint(row.color) }}
    >
      {row.transfer ? (
        <TransferGlyph size={17} />
      ) : (
        row.title.charAt(0).toUpperCase()
      )}
    </span>
  )
}
