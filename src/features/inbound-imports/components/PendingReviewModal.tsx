import type { ReactNode } from 'react'
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
      bodyClassName="px-0"
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-fp-border px-[18px] pb-3">
          {toolbar}
        </div>
      ) : null}

      {imports.length === 0 ? (
        <div className="px-[18px] py-12 text-center text-[13.5px] text-fp-text-3">
          All caught up — nothing waiting.
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
