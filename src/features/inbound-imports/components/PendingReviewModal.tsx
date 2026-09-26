import type { ReactNode } from 'react'
import { CheckCheck } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { useRefreshQueue } from '#/features/inbound-imports/hooks/useRefreshQueue'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { PendingImportRow } from './PendingImportRow'

type Props = {
  imports: LocalInboundImport[]
  wallets: LocalBalanceNode[]
  onClose: () => void
  /** A source's own controls (e.g. an inbox scan), shown above the list. */
  toolbar?: ReactNode
}

export function PendingReviewModal({
  imports,
  wallets,
  onClose,
  toolbar,
}: Props) {
  useRefreshQueue()
  // One live catalog for the whole list rather than one query per row.
  const catalog = useCategoryCatalog()
  const incomplete = imports.filter(
    (i) => i.amount == null || i.currency == null,
  ).length

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="Pending auto-logged"
      description={
        incomplete > 0
          ? `${imports.length} import${imports.length === 1 ? '' : 's'} to review — ${incomplete} need${incomplete === 1 ? 's' : ''} details filled in by hand`
          : `${imports.length} import${imports.length === 1 ? '' : 's'} to review`
      }
      contentClassName="sm:max-w-[560px]"
      bodyClassName="gap-0 px-0 pt-[14px] pb-0"
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-x-[10px] gap-y-2 border-y border-fp-border bg-fp-surface-2 px-5 py-[10px]">
          {toolbar}
        </div>
      ) : null}

      {imports.length === 0 ? (
        <div className="px-5 py-6">
          <EmptyState
            icon={CheckCheck}
            title="All caught up"
            text="Nothing is waiting for review."
          />
        </div>
      ) : (
        imports.map((item) => (
          <PendingImportRow
            key={item.id}
            item={item}
            wallets={wallets}
            catalog={catalog}
          />
        ))
      )}
    </ResponsiveDialog>
  )
}
