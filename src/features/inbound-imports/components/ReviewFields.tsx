import { CurrencyPicker } from '#/components/CurrencyPicker'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { LocalBalanceNode } from '#/db/types'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import type { ReviewCard } from '#/features/inbound-imports/hooks/useReviewQueue'
import { WalletSelectSections } from '#/features/wallets/components/WalletSelectSections'
import { sectionByGroup } from '#/features/wallets/data/walletSections'
import { useWalletGroups } from '#/features/wallets/hooks/useWalletGroups'
import { amountInputProps } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { usePreferencesStore } from '#/stores/preferences'

const NONE = '__none__'

type Props = {
  card: ReviewCard
  wallets: LocalBalanceNode[]
}

/** Every value the entry will post with — prefilled from the read, blank where it found none. */
export function ReviewFields({ card, wallets }: Props) {
  const { item, draft, setField } = card
  const id = `import-${item.id}`
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const groups = useWalletGroups()
  const tapHint = `Enter it, or tap it in the ${bodyNoun(item.bodyFormat)} below.`

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 items-start gap-3">
        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
          <Input
            id={`${id}-amount`}
            {...amountInputProps(draft.currency, draft.amount, (v) =>
              setField('amount', v),
            )}
            aria-invalid={card.amountMissing ? true : undefined}
            className="tabular-nums"
          />
          {card.amountMissing ? <FieldMessage error={tapHint} /> : null}
        </div>
        <div className="min-w-0">
          <FieldLabel>Currency</FieldLabel>
          <CurrencyPicker
            value={draft.currency}
            onChange={(code) => setField('currency', code)}
            className={cn(
              card.currencyMissing && 'border-fp-danger bg-fp-danger/[0.07]',
            )}
          />
          {card.currencyMissing ? <FieldMessage error={tapHint} /> : null}
        </div>

        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-merchant`} optional>
            Merchant
          </FieldLabel>
          <Input
            id={`${id}-merchant`}
            value={draft.merchant}
            onChange={(e) => setField('merchant', e.target.value)}
            placeholder="Who was paid"
          />
        </div>
        <div className="min-w-0">
          <FieldLabel>Date</FieldLabel>
          <DateField
            value={draft.date}
            onChange={(iso) => setField('date', iso)}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
        </div>

        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
          <CategoryPicker
            id={`${id}-category`}
            type={draft.type}
            categoryId={draft.categoryId || null}
            onChange={(categoryId) => setField('categoryId', categoryId)}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-account`}>Account</FieldLabel>
          <Select
            value={draft.walletId || NONE}
            onValueChange={(v) => setField('walletId', v === NONE ? '' : v)}
          >
            <SelectTrigger id={`${id}-account`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {wallets.length === 0 ? (
                <SelectItem value={NONE}>No accounts</SelectItem>
              ) : null}
              <WalletSelectSections
                sections={sectionByGroup(groups, wallets)}
                renderItem={(w) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span
                      aria-hidden
                      className="size-[10px] flex-none rounded-[3px]"
                      style={{ background: w.color }}
                    />
                    <span className="truncate">{w.name}</span>
                  </SelectItem>
                )}
              />
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-w-0">
        <FieldLabel htmlFor={`${id}-note`} optional>
          Note
        </FieldLabel>
        <Input
          id={`${id}-note`}
          value={draft.note}
          onChange={(e) => setField('note', e.target.value)}
          placeholder="Add a note"
        />
      </div>
    </div>
  )
}
