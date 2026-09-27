import { NoteBox } from '#/components/dialog/NoteBox'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { Button } from '#/components/ui/button'
import type { LocalBalanceNode } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { displayName } from '#/features/inbound-imports/data/bodyReads'
import { useImportDetail } from '#/features/inbound-imports/hooks/useImportDetail'
import type { ReviewCard as Card } from '#/features/inbound-imports/hooks/useReviewQueue'
import type { TxType } from '#/features/transactions/api/types'
import { TYPE_TINT } from '#/features/transactions/data/txDialog'
import { parseAmountToMinor } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { MerchantHint } from './MerchantHint'
import { PendingImportHeader } from './PendingImportHeader'
import { ReviewEmail } from './ReviewEmail'
import { ReviewFields } from './ReviewFields'

const TYPES = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
] as const

const SMALL = 'rounded-[11px] px-3 py-2 text-[13px]'

type Props = {
  card: Card
  wallets: LocalBalanceNode[]
  catalog: CategoryCatalog
  busy: boolean
}

/** One staged import: the details first, the email it came from below, then what to do. */
export function ReviewCard({ card, wallets, catalog, busy }: Props) {
  const { item, draft } = card
  const detail = useImportDetail({ kind: 'import', id: item.id }, true)
  const merchant = detail.detail?.merchant ?? null

  return (
    <div className="flex flex-col gap-3">
      <PendingImportHeader
        item={item}
        title={
          draft.merchant.trim()
            ? displayName(draft.merchant)
            : item.sourceLabel || item.sourceRef || ''
        }
        type={draft.type}
        amountMinor={
          card.needsDetails
            ? null
            : parseAmountToMinor(draft.amount, draft.currency)
        }
        currency={draft.currency}
      />

      {merchant ? <MerchantHint merchant={merchant} catalog={catalog} /> : null}

      <PillSwitch<TxType>
        label="Type"
        options={TYPES}
        value={draft.type}
        onChange={card.setType}
        color={TYPE_TINT[draft.type].ink}
      />

      <ReviewFields card={card} wallets={wallets} />

      <ReviewEmail
        item={item}
        detail={detail.detail}
        loading={detail.loading}
        error={detail.error}
        values={{
          amount: draft.amount,
          currency: draft.currency,
          merchant: draft.merchant,
        }}
        target={card.target}
        onTarget={card.setTarget}
        onUse={card.use}
      />

      {card.error ? (
        <NoteBox tone="danger">
          <span role="alert">{card.error}</span>
        </NoteBox>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button
          type="button"
          variant="quiet"
          onClick={card.ignore}
          disabled={busy}
          className={cn(SMALL, 'font-bold')}
        >
          Ignore
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={card.notTransaction}
          disabled={busy}
          title={
            item.skippable
              ? 'Also skips ones like it from now on'
              : 'Drops this import'
          }
          className={cn(SMALL, 'font-bold')}
        >
          Not a transaction
        </Button>
        <span className="flex-1" />
        <Button
          type="button"
          onClick={() => void card.confirm()}
          disabled={busy || !card.ready}
          className={cn(
            SMALL,
            'px-[14px] font-extrabold shadow-[0_6px_16px_-8px_var(--fp-accent)]',
            'disabled:bg-fp-surface-2 disabled:text-fp-text-3 disabled:opacity-100 disabled:shadow-none',
          )}
        >
          Confirm &amp; add
        </Button>
      </div>
    </div>
  )
}
