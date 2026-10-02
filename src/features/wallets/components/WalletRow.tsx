import { MoreHorizontal, Pencil, Scale } from 'lucide-react'
import type { MouseEvent } from 'react'
import { IconChip } from '#/components/icons/IconChip'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type {
  BalanceRow,
  SetAsideLineRow,
} from '#/features/wallets/data/selectors'
import { SetAsideLines } from './SetAsideLines'
import { WalletSetAsideLine } from './WalletSetAsideLine'

type Props = {
  row: BalanceRow
  /** The balance is still loading. */
  loading: boolean
  /** Its set-aside list is open. */
  expanded: boolean
  onToggleLines: (id: string) => void
  onEdit: (id: string) => void
  onAdjust: (id: string) => void
  onDelete: (id: string) => void
  onSetAside: (id: string) => void
  onOpenLine: (line: SetAsideLineRow) => void
}

// the row runs out of width at 320px; below `sm` the chip and this cluster both give some back.
const ACTION =
  'size-6 sm:size-7 rounded-lg text-fp-text-3 hover:bg-fp-bg max-sm:[&_svg]:size-[13px]'

const stop = (fn: (id: string) => void, id: string) => (e: MouseEvent) => {
  e.stopPropagation()
  fn(id)
}

/**
 * A wallet (03 §8): its **Balance** — the bank's number — stays the big figure. One holding
 * set-aside money adds "Set aside X · Free to spend Y" (red "X over" when it holds more than
 * its balance) and a line naming what it holds, which opens the list.
 */
export function WalletRow({
  row,
  loading,
  expanded,
  onToggleLines,
  onEdit,
  onAdjust,
  onDelete,
  onSetAside,
  onOpenLine,
}: Props) {
  const held = row.hasSetAside && !loading
  return (
    <div className="border-b border-fp-border">
      <div
        onClick={() => onEdit(row.id)}
        className="flex cursor-pointer items-center gap-[7px] px-[10px] py-[11px] hover:bg-fp-surface-2 sm:gap-[10px] sm:px-[14px]"
      >
        <div
          style={{ marginInlineStart: row.depth * 20 }}
          className="shrink-0"
        />
        <IconChip
          id={row.icon}
          color={row.color}
          className="max-sm:size-7 max-sm:[&>svg]:size-[15px]"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold whitespace-nowrap">
              {row.name}
            </span>
            <span className="fp-sensitive shrink-0 text-[14px] font-bold tabular-nums whitespace-nowrap">
              <ValueOrSkeleton
                value={loading ? null : row.amountStr}
                className="h-3.5 w-20"
              />
            </span>
          </div>
          {held ? <WalletSetAsideLine row={row} /> : null}
          {row.isForeign && !loading ? (
            <span className="fp-sensitive self-end text-[11.5px] whitespace-nowrap text-fp-text-3 tabular-nums">
              {row.baseStr}
            </span>
          ) : null}
          {row.note ? (
            <span className="max-w-[240px] truncate text-[12px] text-fp-text-3">
              {row.note}
            </span>
          ) : null}
        </div>
        <div className="ms-[2px] flex shrink-0 gap-px">
          <Button
            variant="ghost"
            size="icon"
            title="Edit"
            className={`${ACTION} hover:text-fp-text`}
            onClick={stop(onEdit, row.id)}
          >
            <Pencil size={14} strokeWidth={1.8} />
          </Button>
          {/* Mobile adjusts from the menu; the row has no width to spare there. */}
          <Button
            variant="ghost"
            size="icon"
            title="Adjust balance"
            aria-label="Adjust balance"
            className={`${ACTION} hidden hover:text-fp-text md:inline-flex`}
            onClick={stop(onAdjust, row.id)}
          >
            <Scale size={14} strokeWidth={1.8} />
          </Button>
          <WalletMenu
            name={row.name}
            onSetAside={() => onSetAside(row.id)}
            onAdjust={() => onAdjust(row.id)}
            onDelete={() => onDelete(row.id)}
          />
        </div>
      </div>

      {held ? (
        <SetAsideLines
          row={row}
          expanded={expanded}
          onToggle={() => onToggleLines(row.id)}
          onOpen={onOpenLine}
        />
      ) : null}
    </div>
  )
}

/** The row's ⋯: Set aside… (pick a bill or goal), Adjust balance, Delete. */
function WalletMenu({
  name,
  onSetAside,
  onAdjust,
  onDelete,
}: {
  name: string
  onSetAside: () => void
  onAdjust: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="More"
          aria-label={`More for ${name}`}
          className={`${ACTION} hover:text-fp-text`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={15} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[190px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onSelect={onSetAside}>Set aside…</DropdownMenuItem>
        <DropdownMenuItem onSelect={onAdjust}>Adjust balance</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
