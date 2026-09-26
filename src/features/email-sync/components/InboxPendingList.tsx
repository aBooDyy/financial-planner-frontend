import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { usePendingImports } from '#/features/inbound-imports/hooks/usePendingImports'
import { formatMoney } from '#/lib/currency'

const SHOWN = 4

/** What this inbox left waiting for review, newest first. */
export function InboxPendingList({ connectionId }: { connectionId: string }) {
  const { imports } = usePendingImports()
  const mine = imports.filter((i) => i.connectionId === connectionId)
  if (mine.length === 0) return null

  return (
    <section
      aria-labelledby="inbox-pending-heading"
      className="flex min-w-0 flex-col gap-1 rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface p-[14px]"
    >
      <div className="flex items-center gap-2">
        <h3
          id="inbox-pending-heading"
          className="flex-1 text-[15px] font-extrabold"
        >
          Waiting for review · {mine.length}
        </h3>
        <Link
          to="/transactions"
          search={{ review: true }}
          className="inline-flex items-center gap-1 text-[13px] font-bold text-fp-accent-ink hover:underline"
        >
          Review
          <ArrowRight size={13} strokeWidth={2.2} className="rtl:rotate-180" />
        </Link>
      </div>
      <ul>
        {mine.slice(0, SHOWN).map((item) => {
          const name =
            item.suggestedMerchant ??
            item.subject ??
            item.sourceLabel ??
            item.sourceRef ??
            ''
          return (
            <li
              key={item.id}
              className="flex items-center gap-[10px] border-t border-fp-border py-[10px]"
            >
              <span
                aria-hidden
                className="flex size-7 flex-none items-center justify-center rounded-[8px] bg-fp-surface-2 text-[12px] font-extrabold text-fp-text-2 uppercase"
              >
                {name.trim().charAt(0) || '·'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">
                  <bdi>{name}</bdi>
                </div>
                <div className="text-[12px] text-fp-text-3">
                  {item.occurredOn ?? ''}
                </div>
              </div>
              <div className="shrink-0 text-[13.5px] font-bold tabular-nums">
                {item.amount !== null && item.currency ? (
                  <bdi>{formatMoney(item.amount, item.currency)}</bdi>
                ) : (
                  <span className="text-fp-spend">Needs details</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
