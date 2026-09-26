import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import { Button } from '#/components/ui/button'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { ImportMerchant } from '#/features/inbound-imports/api/types'
import { useImportDetail } from '#/features/inbound-imports/hooks/useImportDetail'
import { useImportReview } from '#/features/inbound-imports/hooks/useImportReview'
import { useUndoableDismiss } from '#/features/inbound-imports/hooks/useUndoableDismiss'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import { parseAmountToMinor } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { BodyPreview } from './BodyPreview'
import { FixRuleLink } from './FixRuleLink'
import { ImportDetailsFields } from './ImportDetailsFields'
import { ImportQuickFields } from './ImportQuickFields'
import { PendingImportHeader } from './PendingImportHeader'

type Props = {
  item: LocalInboundImport
  wallets: LocalBalanceNode[]
  catalog: CategoryCatalog
}

const ROW =
  'flex flex-col gap-3 border-b border-fp-border px-5 py-4 last:border-b-0 last:pb-5'

/** A row that parsed empty is faintly warmed, so the eye finds the ones that need a hand. */
const NEEDS_TINT =
  'bg-[color-mix(in_srgb,var(--fp-spend)_3%,var(--fp-surface))]'

const SMALL = 'rounded-[11px] px-3 py-2 text-[13px]'

function MerchantHint({
  merchant,
  catalog,
}: {
  merchant: ImportMerchant
  catalog: CategoryCatalog
}) {
  if (merchant.timesConfirmed === 0) return null
  return (
    <NoteBox icon={<Sparkles />}>
      {merchant.displayName} — you filed it under{' '}
      {merchant.learnedCategoryId && catalog.has(merchant.learnedCategoryId)
        ? catalog.labelOf(merchant.learnedCategoryId)
        : 'a category'}{' '}
      {merchant.timesConfirmed === 1
        ? 'last time'
        : `${merchant.timesConfirmed} times`}
    </NoteBox>
  )
}

function DismissedRow({ onUndo }: { onUndo: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-fp-border px-5 py-[14px] last:border-b-0"
    >
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-fp-text-2">
        Marked as not a transaction.
      </span>
      <Button type="button" variant="quiet" onClick={onUndo} className={SMALL}>
        Undo
      </Button>
    </div>
  )
}

export function PendingImportRow({ item, wallets, catalog }: Props) {
  const review = useImportReview(item, wallets, catalog)
  const { draft, busy, error, needsDetails } = review
  // An import that parsed empty can't be confirmed as-is — open it on the details it needs.
  const [open, setOpen] = useState(needsDetails)
  const detail = useImportDetail({ kind: 'import', id: item.id }, open)
  const dismissal = useUndoableDismiss(review.dismiss)

  if (dismissal.held) return <DismissedRow onUndo={dismissal.undo} />

  const noun = item.hasBody
    ? `${bodyNoun(item.bodyFormat)} & details`
    : 'details'
  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-fp-accent-ink hover:underline"
    >
      {open ? 'Hide' : 'View'} {noun}
      <ChevronDown
        aria-hidden
        size={14}
        strokeWidth={2.4}
        className={cn('transition-transform', open && 'rotate-180')}
      />
    </button>
  )

  return (
    <div className={cn(ROW, needsDetails && NEEDS_TINT)}>
      <PendingImportHeader
        item={item}
        title={draft.merchant || item.sourceLabel || item.sourceRef || ''}
        type={draft.type}
        amountMinor={parseAmountToMinor(draft.amount, draft.currency)}
        currency={draft.currency}
      />

      {detail.detail?.merchant ? (
        <MerchantHint merchant={detail.detail.merchant} catalog={catalog} />
      ) : null}

      <ImportQuickFields
        id={`import-${item.id}`}
        review={review}
        wallets={wallets}
      />

      {open ? (
        <>
          {toggle}
          <BodyPreview
            format={item.bodyFormat}
            lines={detail.detail?.bodyLines ?? []}
            truncated={detail.detail?.bodyTruncated ?? false}
            loading={detail.loading}
            error={detail.error}
            onUseLine={review.useLine}
            picking={{
              target: review.target,
              onTarget: review.setTarget,
              onPick: review.pick,
            }}
            footer={needsDetails ? <FixRuleLink item={item} /> : null}
          />
          <ImportDetailsFields id={`import-${item.id}`} review={review} />
        </>
      ) : null}

      {error ? (
        <NoteBox tone="danger">
          <span role="alert">{error}</span>
        </NoteBox>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex min-w-0 flex-1">{open ? null : toggle}</span>
        <Button
          type="button"
          variant="quiet"
          onClick={dismissal.start}
          disabled={busy}
          className={SMALL}
        >
          Not a transaction
        </Button>
        <Button
          type="button"
          onClick={() => void review.confirm()}
          disabled={busy}
          aria-disabled={!review.ready || undefined}
          className={cn(
            SMALL,
            'font-extrabold shadow-[0_6px_16px_-8px_var(--fp-accent)]',
            !review.ready &&
              'bg-fp-surface-2 text-fp-text-3 shadow-none hover:bg-fp-surface-2 hover:brightness-100',
          )}
        >
          Confirm &amp; add
        </Button>
      </div>
    </div>
  )
}
