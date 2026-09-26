import { memo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { useIconPicker } from './useIconPicker'
import type { IconPickerGroup } from './useIconPicker'
import { Button } from '#/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#/components/ui/command'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { ICON_IDS } from '#/lib/icons/catalog.gen'
import { usePreferencesStore } from '#/stores/preferences'
import type { IconId } from '#/lib/icons/catalog.gen'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The entity's stored icon; `null` means it falls back to its kind's default. */
  value: IconId | null
  /** The entity's colour — every tile draws its glyph in it. */
  color: string
  /** Called with the picked id, or `null` when the user clears back to the default. */
  onSelect: (id: IconId | null) => void
  title?: string
}

const COLUMNS = 'grid grid-cols-6 gap-2 sm:grid-cols-8'

const GROUP =
  'overflow-visible p-0 pb-[10px] [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:pt-0 [&_[cmdk-group-heading]]:pb-[10px] [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-items]]:grid [&_[cmdk-group-items]]:grid-cols-6 [&_[cmdk-group-items]]:gap-2 sm:[&_[cmdk-group-items]]:grid-cols-8'

/** The shared command input's well, flush and a touch taller for the dialog. */
const SEARCH_WELL =
  'flex flex-col gap-[10px] overflow-visible rounded-none [&_[data-slot=command-input-wrapper]]:m-0 [&_[data-slot=command-input]]:h-auto [&_[data-slot=command-input]]:py-3'

// The glyph's colour at 12% for every tile, a touch deeper under the pointer or arrow keys.
const TILE =
  'aspect-square w-full justify-center gap-0 rounded-[11px] p-0 bg-[color-mix(in_oklab,var(--tile)_12%,transparent)] data-[selected=true]:bg-[color-mix(in_oklab,var(--tile)_22%,transparent)]'

const SKELETON_TILES = 48

type TileProps = {
  id: IconId
  label: string
  color: string
  picked: boolean
  /** cmdk's identity for the row; prefixed in Recent so a repeat isn't a duplicate. */
  value: string
  onPick: (id: IconId) => void
}

const IconTile = memo(function IconTile({
  id,
  label,
  color,
  picked,
  value,
  onPick,
}: TileProps) {
  return (
    <CommandItem
      value={value}
      onSelect={() => onPick(id)}
      aria-label={label}
      title={label}
      className={TILE}
      style={
        {
          color,
          '--tile': color,
          boxShadow: picked
            ? `0 0 0 2px var(--fp-surface), 0 0 0 4px ${color}`
            : undefined,
        } as CSSProperties
      }
    >
      <Icon id={id} size={20} />
    </CommandItem>
  )
})

type GroupProps = {
  group: IconPickerGroup
  color: string
  value: IconId | null
  labelOf: (id: IconId) => string
  onPick: (id: IconId) => void
}

const IconGroup = memo(function IconGroup({
  group,
  color,
  value,
  labelOf,
  onPick,
}: GroupProps) {
  if (group.ids.length === 0) return null
  return (
    <CommandGroup heading={group.label} className={GROUP}>
      {group.ids.map((id) => (
        <IconTile
          key={`${group.key}-${id}`}
          id={id}
          label={labelOf(id)}
          color={color}
          picked={id === value}
          value={group.key === 'recent' ? `recent:${id}` : id}
          onPick={onPick}
        />
      ))}
    </CommandGroup>
  )
})

function SkeletonGrid() {
  return (
    <div className={COLUMNS}>
      {Array.from({ length: SKELETON_TILES }, (_, i) => (
        <div
          key={i}
          className="aspect-square animate-pulse rounded-[11px] bg-fp-surface-2"
        />
      ))}
    </div>
  )
}

/** The highlighted tile: the entity's own icon while browsing, the top hit while searching. */
const highlightFor = (
  groups: Array<IconPickerGroup>,
  searching: boolean,
  value: IconId | null,
) => {
  if (!searching && value !== null) return value
  const first = groups.find((g) => g.ids.length > 0)?.ids[0]
  return first ?? ''
}

type BodyProps = {
  value: IconId | null
  color: string
  onPick: (id: IconId) => void
}

function IconOptions({ value, color, onPick }: BodyProps) {
  const { query, setQuery, ready, searching, groups, labelOf } = useIconPicker()
  const highlight = highlightFor(groups, searching, value)

  // cmdk only tracks the best match itself while it owns the filtering; driving the
  // highlight here keeps it on the chosen icon at open and on the top hit as results change.
  const [active, setActive] = useState(highlight)
  const [shown, setShown] = useState(groups)
  if (shown !== groups) {
    setShown(groups)
    setActive(highlight)
  }

  return (
    <Command
      shouldFilter={false}
      value={active}
      onValueChange={setActive}
      className={SEARCH_WELL}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search icons…"
      />
      {/* Inset by the chosen tile's ring, so the list's clipping never cuts it. */}
      <CommandList className="-mx-1 max-h-[min(52vh,340px)] px-1 pt-1">
        {ready ? (
          <>
            <CommandEmpty>{`No icon matches "${query.trim()}".`}</CommandEmpty>
            {groups.map((group) => (
              <IconGroup
                key={group.key}
                group={group}
                color={color}
                value={value}
                labelOf={labelOf}
                onPick={onPick}
              />
            ))}
          </>
        ) : (
          <SkeletonGrid />
        )}
      </CommandList>
    </Command>
  )
}

/**
 * The shared icon picker: a searchable, grouped grid of the whole pack, tinted with the
 * colour of the thing being edited. Picking closes; **Clear** hands back `null`.
 */
export function IconPicker({
  open,
  onOpenChange,
  value,
  color,
  onSelect,
  title = 'Choose an icon',
}: Props) {
  const noteIconUsed = usePreferencesStore((s) => s.noteIconUsed)

  const pick = (id: IconId) => {
    noteIconUsed(id)
    onSelect(id)
    onOpenChange(false)
  }

  const clear = () => {
    onSelect(null)
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      contentClassName="sm:max-w-[440px]"
      bodyClassName="gap-[10px]"
      footer={
        <>
          <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-fp-text-3">
            {ICON_IDS.length} icons
          </span>
          <Button variant="quiet" size="dialog" onClick={clear}>
            Use the default icon
          </Button>
        </>
      }
    >
      {/* Mounting 258 tiles for a closed picker is exactly what the lazy chunks avoid. */}
      {open ? <IconOptions value={value} color={color} onPick={pick} /> : null}
    </ResponsiveDialog>
  )
}
