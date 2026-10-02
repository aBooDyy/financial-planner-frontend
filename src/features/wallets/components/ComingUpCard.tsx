import { Link } from '@tanstack/react-router'
import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { Skeleton } from '#/components/ui/skeleton'
import { COMING_UP_DAYS } from '#/features/wallets/data/comingUp'
import type { ComingUpView } from '#/features/wallets/data/comingUp'
import { ComingUpWalletBlock } from './ComingUpWalletBlock'
import { RailCardHeader } from '#/components/RailCardHeader'

type Props = {
  /** `null` while the balances or the planned rows load. */
  view: ComingUpView | null
}

const plural = (n: number) => (n === 1 ? 'item has' : 'items have')

export function ComingUpCard({ view }: Props) {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader
        title="Coming up"
        sub={`Bills and income, next ${COMING_UP_DAYS} days`}
        action={
          <Link
            to="/planning/$section"
            params={{ section: 'upcoming' }}
            className="shrink-0 text-[12px] font-semibold text-fp-accent-ink hover:underline"
          >
            See all
          </Link>
        }
      />
      {view === null ? (
        <div aria-hidden className="flex flex-col gap-[10px]">
          <Skeleton className="h-[30px] rounded-[10px]" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : view.isEmpty ? (
        <EmptyState
          icon={CalendarCheck}
          size="sm"
          title="Nothing due soon"
          text="Recurring bills and paydays show up here before they land."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {view.wallets.map((wallet, i) => (
            <div
              key={wallet.id}
              className={i > 0 ? 'border-t border-fp-border pt-4' : undefined}
            >
              <ComingUpWalletBlock wallet={wallet} />
            </div>
          ))}
          {view.unassignedCount > 0 ? (
            <div className="text-[12px] text-fp-text-3">
              {view.unassignedCount} {plural(view.unassignedCount)} no wallet
              yet.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
