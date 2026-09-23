import { useState } from 'react'
import { Braces, ChevronDown, Mail, Sparkles } from 'lucide-react'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { ImportMerchant } from '#/features/inbound-imports/api/types'
import { useImportDetail } from '#/features/inbound-imports/hooks/useImportDetail'
import { useImportReview } from '#/features/inbound-imports/hooks/useImportReview'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import { formatMoney, parseAmountToMinor } from '#/lib/currency'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { BodyPreview } from './BodyPreview'
import { FixRuleLink } from './FixRuleLink'
import { ImportDetailsFields } from './ImportDetailsFields'
import { SourceChip } from './SourceChip'

type Props = {
  item: LocalInboundImport
  wallets: LocalBalanceNode[]
  catalog: CategoryCatalog
}

function MerchantHint({
  merchant,
  catalog,
}: {
  merchant: ImportMerchant
  catalog: CategoryCatalog
}) {
  if (merchant.timesConfirmed === 0) return null
  return (
    <div className="flex items-center gap-[6px] rounded-[10px] bg-fp-accent-soft px-[11px] py-[7px] text-[11.5px] font-semibold text-fp-accent-ink">
      <Sparkles size={13} strokeWidth={2.2} className="shrink-0" />
      <span className="min-w-0 truncate">
        {merchant.displayName} — you filed it under{' '}
        {merchant.learnedCategory
          ? catalog.get(merchant.learnedCategory).name
          : 'a category'}{' '}
        {merchant.timesConfirmed === 1
          ? 'last time'
          : `${merchant.timesConfirmed} times`}
      </span>
    </div>
  )
}

export function PendingImportRow({ item, wallets, catalog }: Props) {
  const review = useImportReview(item, wallets, catalog)
  const { draft, categories, busy, error, needsDetails } = review
  // An import that parsed empty can't be confirmed as-is — open it on the details it needs.
  const [open, setOpen] = useState(needsDetails)
  const detail = useImportDetail({ kind: 'import', id: item.id }, open)

  const amountMinor = parseAmountToMinor(draft.amount, draft.currency)
  const BodyGlyph = item.bodyFormat === 'json' ? Braces : Mail
  const canFixRule = needsDetails && item.source === 'webhook' && !!item.keyId

  return (
    <div className="border-b border-fp-border px-[18px] py-[14px] last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">
            {draft.merchant || item.sourceLabel || item.sourceRef}
          </div>
          <div className="flex min-w-0 items-center gap-[5px] text-[12px] text-fp-text-3">
            <SourceChip source={item.source} />
            <span className="truncate">
              {item.sourceLabel ?? item.sourceRef}
              {item.occurredOn ? ` · ${item.occurredOn}` : ''}
            </span>
          </div>
        </div>
        {amountMinor != null && amountMinor > 0 ? (
          <div className="shrink-0 text-[15px] font-extrabold tabular-nums">
            {draft.type === 'spend' ? '− ' : '+ '}
            {formatMoney(amountMinor, draft.currency)}
          </div>
        ) : (
          <span className="shrink-0 rounded-full border border-fp-border-strong bg-fp-surface-2 px-[9px] py-1 text-[10.5px] font-bold uppercase tracking-wide text-fp-danger">
            Needs details
          </span>
        )}
      </div>

      <div className="mt-[10px] grid grid-cols-2 gap-2">
        <Select value={draft.category} onValueChange={review.setCategory}>
          <SelectTrigger className="px-3 py-2 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={draft.walletId || '__none__'}
          onValueChange={(v) =>
            review.setField('walletId', v === '__none__' ? '' : v)
          }
        >
          <SelectTrigger className="px-3 py-2 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {wallets.length === 0 ? (
              <SelectItem value="__none__">No accounts</SelectItem>
            ) : null}
            {wallets.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-[10px] flex w-full items-center gap-[7px] text-[12.5px] font-semibold text-fp-text-2"
      >
        <BodyGlyph size={14} strokeWidth={2} />
        {open ? 'Hide' : 'View'}
        {item.hasBody ? ` ${bodyNoun(item.bodyFormat)} & details` : ' details'}
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          className={open ? 'rotate-180' : ''}
        />
      </button>

      {open ? (
        <div className="mt-[10px] flex flex-col gap-[11px]">
          {detail.detail?.merchant ? (
            <MerchantHint merchant={detail.detail.merchant} catalog={catalog} />
          ) : null}
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
          />
          {canFixRule && item.keyId ? (
            <FixRuleLink keyId={item.keyId} importId={item.id} />
          ) : null}
          <ImportDetailsFields review={review} />
        </div>
      ) : null}

      {error ? (
        <div className="mt-[10px] text-[12px] font-semibold text-fp-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-[10px] flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void review.dismiss()}
          disabled={busy}
          className="px-3 py-2 text-[13px] font-semibold text-fp-text-2"
        >
          Not a transaction
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          onClick={() => void review.confirm()}
          disabled={busy || !draft.walletId}
          className="px-4 py-2 text-[13px]"
        >
          Confirm &amp; add
        </Button>
      </div>
    </div>
  )
}
