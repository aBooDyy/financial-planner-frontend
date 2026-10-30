import { AmountWell } from '#/components/dialog/AmountWell'
import type { AmountTone } from '#/components/dialog/AmountWell'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
import type { LocalBalanceNode } from '#/db/types'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import type { ReviewCard } from '#/features/inbound-imports/hooks/useReviewQueue'
import type { TxType } from '#/features/transactions/api/types'
import { TxAccountPill } from '#/features/transactions/components/TxAccountPill'
import { AMOUNT_QUESTION } from '#/features/transactions/data/txDialog'
import { useAccountSections } from '#/features/transactions/hooks/useAccountSections'
import { WALLET_ICON, iconIdOr } from '#/lib/icons/fallbacks'
import { MerchantHint } from './MerchantHint'

const AMOUNT_TONE: Record<TxType, AmountTone> = {
  spend: 'spend',
  income: 'accent',
}

type Props = {
  card: ReviewCard
  wallets: LocalBalanceNode[]
  catalog: CategoryCatalog
}

/** What matters most on an entry — amount and account, category, note — prefilled from the read. */
export function ReviewFields({ card, wallets, catalog }: Props) {
  const { item, draft, setField } = card
  const id = `import-${item.id}`
  const { sections, amountsLoading } = useAccountSections(wallets)
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
          <TxAccountPill
            label={accountLabel}
            sections={sections}
            chosen={
              wallet
                ? { ...wallet, icon: iconIdOr(wallet.icon, WALLET_ICON) }
                : null
            }
            archived={false}
            onChange={(walletId) => setField('walletId', walletId)}
            invalid={!draft.walletId}
            amountsLoading={amountsLoading}
            placeholder="Pick an account"
          />
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
