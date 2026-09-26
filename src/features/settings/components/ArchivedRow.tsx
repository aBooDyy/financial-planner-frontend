import { RotateCcw, Trash2 } from 'lucide-react'
import { IconChip } from '#/components/icons/IconChip'
import { Button } from '#/components/ui/button'
import type { ArchivedItem } from '#/features/wallets/data/archivedList'

type Props = {
  item: ArchivedItem
  onRestore: () => void
  onDelete: () => void
  last: boolean
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function detail(item: ArchivedItem): string {
  const parts = [
    item.kind === 'group' ? plural(item.walletCount, 'wallet') : 'Wallet',
    `archived ${item.archivedStr}`,
  ]
  if (item.placeName) parts.push(`in ${item.placeName}`)
  return parts.join(' · ')
}

export function ArchivedRow({ item, onRestore, onDelete, last }: Props) {
  return (
    <div
      className={`flex items-center gap-3 px-[14px] py-[13px] sm:px-[18px] ${
        last ? '' : 'border-b border-fp-border'
      }`}
    >
      <IconChip
        id={item.icon}
        color={item.color}
        className="opacity-70 grayscale-[35%]"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold">
            {item.name}
          </span>
          <span className="ms-auto shrink-0 text-[13px] font-bold whitespace-nowrap text-fp-text-2 tabular-nums">
            {item.balanceStr}
          </span>
        </div>
        <span className="truncate text-[12px] text-fp-text-3">
          {detail(item)}
        </span>
        {item.stranded ? (
          <span className="text-[12px] text-fp-text-3">
            Its group is archived too — restoring puts it at the top level.
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          onClick={onRestore}
          title={`Restore ${item.name}`}
          className="h-8 gap-[5px] px-[10px] text-[12.5px] hover:border-fp-accent hover:text-fp-accent-ink"
        >
          <RotateCcw size={14} strokeWidth={2} />
          <span className="max-sm:sr-only">Restore</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title={`Delete ${item.name} for good`}
          className="h-8 w-8 rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-danger"
        >
          <Trash2 size={15} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  )
}
