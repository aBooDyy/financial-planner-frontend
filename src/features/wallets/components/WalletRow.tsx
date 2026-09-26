import { Pencil, Scale, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'
import { IconChip } from '#/components/icons/IconChip'
import { Button } from '#/components/ui/button'
import type { BalanceRow } from '#/features/wallets/data/selectors'
import { PotRow } from './PotRow'
import { ReservedWalletLines } from './ReservedWalletLines'

type Props = {
  row: BalanceRow
  onEdit: (id: string) => void
  onAdjust: (id: string) => void
  onDelete: (id: string) => void
  onOpenGoal: (goalId: string) => void
}

// the row runs out of width at 320px; below `sm` the chip and this cluster both give some back.
const ACTION =
  'size-6 sm:size-7 rounded-lg text-fp-text-3 hover:bg-fp-bg max-sm:[&_svg]:size-[13px]'

const stop = (fn: (id: string) => void, id: string) => (e: MouseEvent) => {
  e.stopPropagation()
  fn(id)
}

/**
 * A wallet. One holding goal money leads with what is free to spend and lists its pots —
 * what each goal holds in it — right underneath (05 §6).
 */
export function WalletRow({
  row,
  onEdit,
  onAdjust,
  onDelete,
  onOpenGoal,
}: Props) {
  const pots = row.hasReserved
  return (
    <>
      <div
        onClick={() => onEdit(row.id)}
        className={`flex cursor-pointer items-center gap-[7px] px-[10px] py-[11px] hover:bg-fp-surface-2 sm:gap-[10px] sm:px-[14px] ${
          pots ? '' : 'border-b border-fp-border'
        }`}
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
        {pots ? (
          <ReservedWalletLines row={row} />
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-semibold whitespace-nowrap">
                {row.name}
              </span>
              {row.note ? (
                <span className="max-w-[240px] truncate text-[12px] text-fp-text-3">
                  {row.note}
                </span>
              ) : null}
            </div>
            <div className="fp-sensitive flex shrink-0 flex-col items-end">
              <span className="text-[14px] font-bold tabular-nums whitespace-nowrap">
                {row.amountStr}
              </span>
              {row.isForeign ? (
                <span className="text-[11.5px] whitespace-nowrap text-fp-text-3 tabular-nums">
                  {row.baseStr}
                </span>
              ) : null}
            </div>
          </>
        )}
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
          {/* Mobile adjusts from the wallet editor; the row has no width to spare there. */}
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
          <Button
            variant="ghost"
            size="icon"
            title="Delete"
            className={`${ACTION} hover:text-fp-danger`}
            onClick={stop(onDelete, row.id)}
          >
            <Trash2 size={14} strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      {pots ? (
        <div className="border-b border-fp-border">
          {row.reservations.map((pot, i) => (
            <PotRow
              key={pot.goalId}
              pot={pot}
              depth={row.depth}
              last={i === row.reservations.length - 1}
              onOpen={onOpenGoal}
            />
          ))}
        </div>
      ) : null}
    </>
  )
}
