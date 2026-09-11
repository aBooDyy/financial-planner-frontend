import type { LocalBalanceNode, LocalPendingImport } from '#/db/types'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { PendingImportRow } from './PendingImportRow'

type Props = {
  imports: LocalPendingImport[]
  wallets: LocalBalanceNode[]
  onClose: () => void
}

export function PendingReviewModal({ imports, wallets, onClose }: Props) {
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
          ? `${imports.length} alert${imports.length === 1 ? '' : 's'} to review — ${incomplete} need${incomplete === 1 ? 's' : ''} details filled in from the email`
          : `${imports.length} alert${imports.length === 1 ? '' : 's'} from your inbox to review`
      }
      contentClassName="sm:max-w-[560px]"
      bodyClassName="px-0"
    >
      {imports.length === 0 ? (
        <div className="px-[18px] py-12 text-center text-[13.5px] text-fp-text-3">
          All caught up — no alerts waiting.
        </div>
      ) : (
        imports.map((item) => (
          <PendingImportRow key={item.id} item={item} wallets={wallets} />
        ))
      )}
    </ResponsiveDialog>
  )
}
