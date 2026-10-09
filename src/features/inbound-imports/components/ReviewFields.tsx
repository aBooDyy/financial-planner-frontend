import { CurrencyPicker } from '#/components/CurrencyPicker'
import { AmountWell } from '#/components/dialog/AmountWell'
import type { AmountTone } from '#/components/dialog/AmountWell'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { IconChip } from '#/components/icons/IconChip'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '#/components/ui/select'
import type { LocalBalanceNode } from '#/db/types'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import type { ReviewCard } from '#/features/inbound-imports/hooks/useReviewQueue'
import type { TxType } from '#/features/transactions/api/types'
import { ACCOUNT_PILL } from '#/features/transactions/components/TxAccountPill'
import { AMOUNT_QUESTION } from '#/features/transactions/data/txDialog'
import { WalletSelectSections } from '#/features/wallets/components/WalletSelectSections'
import { sectionByGroup } from '#/features/wallets/data/walletSections'
import { useWalletGroups } from '#/features/wallets/hooks/useWalletGroups'
import { WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import { cn } from '#/lib/utils'
import { usePreferencesStore } from '#/stores/preferences'
import { MerchantHint } from './MerchantHint'

const NONE = '__none__'

const AMOUNT_TONE: Record<TxType, AmountTone> = {
  spend: 'spend',
  income: 'accent',
}

type Props = {
  card: ReviewCard
  wallets: LocalBalanceNode[]
  catalog: CategoryCatalog
}

/** Every value the entry will post with — prefilled from the read, blank where it found none. */
export function ReviewFields({ card, wallets, catalog }: Props) {
  const { item, draft, setField } = card
  const id = `import-${item.id}`
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const groups = useWalletGroups()
  const tapHint = `Enter it, or tap it in the ${bodyNoun(item.bodyFormat, item.source)} below.`
  const wallet = wallets.find((w) => w.id === draft.walletId)
  const accountLabel = draft.type === 'income' ? 'Paid into' : 'Paid from'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <AmountWell
          question={AMOUNT_QUESTION[draft.type]}
          currency={draft.currency}
          amount={draft.amount}
          onAmount={(v) => setField('amount', v)}
          invalid={card.amountMissing}
          tone={AMOUNT_TONE[draft.type]}
        >
          <Select
            value={draft.walletId || NONE}
            onValueChange={(v) => setField('walletId', v === NONE ? '' : v)}
          >
            <SelectTrigger
              aria-label={accountLabel}
              aria-invalid={draft.walletId ? undefined : true}
              className={ACCOUNT_PILL}
            >
              {wallet ? (
                <IconChip
                  id={iconIdOr(wallet.icon, WALLET_ICON)}
                  color={wallet.color}
                  size={22}
                  iconSize={13}
                  className="rounded-full"
                />
              ) : (
                <span
                  aria-hidden
                  className="size-[22px] flex-none rounded-full bg-fp-surface-2"
                />
              )}
              <span className="flex-none font-semibold whitespace-nowrap text-fp-text-3">
                {accountLabel}
              </span>
              <span className="max-w-[200px] truncate">
                {wallet?.name ?? 'Pick an account'}
              </span>
            </SelectTrigger>
            <SelectContent className="min-w-[260px]">
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
        </AmountWell>
        {card.amountMissing ? (
          <p
            role="alert"
            className="text-center text-[12.5px] font-semibold text-fp-danger"
          >
            {tapHint}
          </p>
        ) : null}
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

      <div className="flex min-w-0 flex-col gap-2">
        <div className="min-w-0">
          <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
          <CategoryPicker
            id={`${id}-category`}
            type={draft.type}
            categoryId={draft.categoryId || null}
            onChange={(categoryId) => setField('categoryId', categoryId)}
          />
        </div>
        {card.merchant ? (
          <MerchantHint
            merchant={card.merchant}
            catalog={catalog}
            selectedId={draft.categoryId}
            onPick={card.pickCategory}
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
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
          <FieldLabel>Date</FieldLabel>
          <DateField
            value={draft.date}
            onChange={(iso) => setField('date', iso)}
            dateFormat={dateFormat}
            ariaLabel="Date"
          />
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
