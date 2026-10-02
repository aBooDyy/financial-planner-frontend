import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '#/lib/utils'
import { ItemMenu } from '#/features/planning/components/kit/ItemMenu'
import type { MenuAction } from '#/features/planning/components/kit/ItemMenu'
import { Spine } from '#/features/planning/components/kit/Spine'
import { StatusChip } from '#/features/planning/components/kit/StatusChip'
import type { Chip } from '#/features/planning/view/itemCopy'

type DragProps = {
  draggable: boolean
  'data-dragging'?: true
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}

type Props = {
  name: string
  color: string
  meta: string
  /** The right column's figure ("SR 3,000", "SR 940", "—"). */
  amount: string
  /** Under the figure, e.g. "a paycheck"; the chip goes there when absent. */
  amountNote?: string
  chip: Chip
  /** A progress bar under the name, when the row saves toward something. */
  progress?: ReactNode
  muted?: boolean
  menu: ReadonlyArray<MenuAction>
  onOpen: () => void
  drag?: DragProps
  onGripKey?: (e: KeyboardEvent) => void
}

/** A bill or goal in its tier: grip, spine, name, progress, meta, figure + chip, ⋯. */
export function ItemRow({
  name,
  color,
  meta,
  amount,
  amountNote,
  chip,
  progress,
  muted,
  menu,
  onOpen,
  drag,
  onGripKey,
}: Props) {
  return (
    <li
      {...drag}
      className={cn(
        'flex items-stretch gap-3 border-t border-fp-border px-4 py-3 transition-opacity data-[dragging]:opacity-40',
        muted && 'opacity-70',
      )}
    >
      {drag ? (
        <button
          type="button"
          aria-label={`Move ${name} (arrow keys)`}
          onKeyDown={onGripKey}
          className="-ms-1 hidden cursor-grab items-center self-center text-fp-text-3 hover:text-fp-text-2 md:flex"
        >
          <GripVertical size={16} aria-hidden />
        </button>
      ) : null}
      <Spine color={color} />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold text-fp-text">
            {name}
          </span>
          {progress ? (
            <span className="mt-[6px] block max-w-[320px]">{progress}</span>
          ) : null}
          <span className="fp-sensitive mt-[3px] block truncate text-[11.5px] text-fp-text-3">
            {meta}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          <span className="fp-sensitive text-[13.5px] font-extrabold text-fp-text tabular-nums">
            {amount}
            {amountNote ? (
              <span className="ms-1 text-[11px] font-semibold text-fp-text-3">
                {amountNote}
              </span>
            ) : null}
          </span>
          <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
        </span>
      </button>
      <span className="flex items-center">
        <ItemMenu label={`More for ${name}`} actions={menu} />
      </span>
    </li>
  )
}
