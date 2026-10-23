import { NoteBox } from '#/components/dialog/NoteBox'
import { Button } from '#/components/ui/button'
import type { LocalBalanceNode, LocalGoal } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { displayName } from '#/features/inbound-imports/data/bodyReads'
import { useImportDetail } from '#/features/inbound-imports/hooks/useImportDetail'
import type { ReviewCard as Card } from '#/features/inbound-imports/hooks/useReviewQueue'
import { PlannedLinkBanner } from '#/features/transactions/components/PlannedLinkBanner'
import { useCountsToward } from '#/features/transactions/hooks/useCountsToward'
import { fmtShort } from '#/features/transactions/data/planning'
import { parseAmountToMinor } from '#/lib/currency'
import { parseISODate } from '#/lib/date'
import { cn } from '#/lib/utils'
import { PendingImportHeader } from './PendingImportHeader'
import { ReviewCountsToward } from './ReviewCountsToward'
import { ReviewDetailFields } from './ReviewDetailFields'
import { ReviewEmail } from './ReviewEmail'
import { ReviewFields } from './ReviewFields'
import { ReviewMoreDetails } from './ReviewMoreDetails'

const SMALL = 'rounded-[11px] px-3 py-2 text-[13px]'

const TYPE_LABEL = { spend: 'Spend', income: 'Income' } as const

type Props = {
  card: Card
  wallets: LocalBalanceNode[]
  goals: ReadonlyArray<LocalGoal>
  catalog: CategoryCatalog
  busy: boolean
}

/**
 * One staged import: amount, category and note up front, a bill or payday it matches beneath,
 * and everything else — type, merchant, currency, date, what it counts toward, the email —
 * folded under More details.
 */
export function ReviewCard({ card, wallets, goals, catalog, busy }: Props) {
  const { item, draft } = card
  const detail = useImportDetail({ kind: 'import', id: item.id }, true)
  const counts = useCountsToward(
    {
      type: draft.type,
      isNew: true,
      goalId: draft.goalId,
      billId: draft.billId,
      plannedId: null,
      amount: draft.amount,
      currency: draft.currency,
      date: draft.date,
      goals,
    },
    { choice: draft.counts, onChoice: card.setCounts },
  )

  const pickCounts = (optionId: string | null) => {
    counts.pick(optionId)
    if (counts.isIncome) return
    const option = [...counts.options.top, ...counts.options.rest].find(
      (o) => o.id === optionId,
    )
    card.setSpendTarget(
      option?.kind === 'bill' || option?.kind === 'goal'
        ? { kind: option.kind, id: option.id }
        : null,
    )
  }

  const day = parseISODate(draft.date)
  const summary = [
    TYPE_LABEL[draft.type],
    draft.merchant.trim() ? displayName(draft.merchant) : null,
    day ? fmtShort(day) : null,
  ]
    .filter(Boolean)
    .join(' · ')

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

      <ReviewFields card={card} wallets={wallets} catalog={catalog} />

      {counts.banner ? (
        <PlannedLinkBanner banner={counts.banner} onLinked={counts.setLinked} />
      ) : null}

      <ReviewMoreDetails summary={summary} defaultOpen={card.needsDetails}>
        <ReviewDetailFields card={card} />
        <ReviewCountsToward counts={counts} onPick={pickCounts} />
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
          defaultOpen={card.needsDetails}
        />
      </ReviewMoreDetails>

      {card.error ? (
        <NoteBox tone="danger">
          <span role="alert">{card.error}</span>
        </NoteBox>
      ) : null}

      <div className="flex items-center gap-2 pt-0.5">
        <Button
          type="button"
          variant="quiet"
          onClick={card.ignore}
          disabled={busy}
          className={cn(SMALL, 'font-bold')}
        >
          Ignore
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
