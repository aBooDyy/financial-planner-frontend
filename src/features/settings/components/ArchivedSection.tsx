import { useState } from 'react'
import { Archive } from 'lucide-react'
import { deleteNode, restoreNode } from '#/features/balances/data/mutations'
import { useArchivedNodes } from '#/features/balances/hooks/useArchivedNodes'
import { ArchivedRow } from './ArchivedRow'
import { DeleteArchivedDialog } from './DeleteArchivedDialog'
import { SectionHeader } from './SectionHeader'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

/** Wallets and groups put away from Balances — restore one, or delete it for good. */
export function ArchivedSection() {
  const { loading, items } = useArchivedNodes()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deleting = items.find((i) => i.id === deletingId) ?? null

  const confirmDelete = () => {
    if (deleting) void deleteNode(deleting.id)
    setDeletingId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Archived"
        subtitle="Wallets and groups you’ve put away. Their history stays intact; restore one to bring it back to Balances."
      />

      <div className={CARD}>
        {loading ? null : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[13px] bg-fp-surface-2 text-fp-text-3">
              <Archive size={20} strokeWidth={1.8} />
            </span>
            <p className="text-[14px] font-semibold">Nothing archived</p>
            <p className="mt-1 max-w-[320px] text-[13px] text-fp-text-3">
              Archive a wallet or group from Balances to tidy it away without
              losing its transactions.
            </p>
          </div>
        ) : (
          items.map((item, i) => (
            <ArchivedRow
              key={item.id}
              item={item}
              onRestore={() => void restoreNode(item.id)}
              onDelete={() => setDeletingId(item.id)}
              last={i === items.length - 1}
            />
          ))
        )}
      </div>

      <DeleteArchivedDialog
        target={deleting}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
