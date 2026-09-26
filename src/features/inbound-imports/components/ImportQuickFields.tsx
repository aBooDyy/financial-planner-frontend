import { FieldLabel } from '#/components/FieldLabel'
import { IconChip } from '#/components/icons/IconChip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { LocalBalanceNode } from '#/db/types'
import type { ImportReview } from '#/features/inbound-imports/hooks/useImportReview'

const NONE = '__none__'

/** On a review row the quick picks stand out from the tinted details as white cards. */
const QUICK_TRIGGER = 'bg-fp-surface'

type Props = {
  id: string
  review: ImportReview
  wallets: LocalBalanceNode[]
}

/** The fast path: the two picks most imports need before Confirm. */
export function ImportQuickFields({ id, review, wallets }: Props) {
  const { draft, categories } = review
  return (
    <div className="grid grid-cols-2 items-start gap-3">
      <div className="min-w-0">
        <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
        <Select value={draft.category} onValueChange={review.setCategory}>
          <SelectTrigger id={`${id}-category`} className={QUICK_TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                <IconChip
                  id={c.icon}
                  color={c.color}
                  size={22}
                  iconSize={12}
                  className="rounded-[7px]"
                />
                <span className="truncate">{c.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0">
        <FieldLabel htmlFor={`${id}-account`}>Account</FieldLabel>
        <Select
          value={draft.walletId || NONE}
          onValueChange={(v) =>
            review.setField('walletId', v === NONE ? '' : v)
          }
        >
          <SelectTrigger id={`${id}-account`} className={QUICK_TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {wallets.length === 0 ? (
              <SelectItem value={NONE}>No accounts</SelectItem>
            ) : null}
            {wallets.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <span
                  aria-hidden
                  className="size-[10px] flex-none rounded-[3px]"
                  style={{ background: w.color }}
                />
                <span className="truncate">{w.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
