import { useState } from 'react'
import { EmptyState } from '#/components/EmptyState'
import { Archive } from 'lucide-react'
import { deleteNode, restoreNode } from '#/features/wallets/data/mutations'
import { useArchivedNodes } from '#/features/wallets/hooks/useArchivedNodes'
import { DeleteNodeDialog } from '#/features/wallets/components/DeleteNodeDialog'
import { ArchivedRow } from './ArchivedRow'
import { SectionHeader } from './SectionHeader'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

/** Wallets and groups put away from the Wallets page — restore one, or delete it for good. */
export function ArchivedSection() {
  const { loading, items, heldStrOf } = useArchivedNodes()
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
        subtitle="Wallets and groups you’ve put away. Their history stays intact; restore one to bring it back to the Wallets page."
      />

      <div className={CARD}>
        {loading ? null : items.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nothing archived"
            text="Archive a wallet or group from the Wallets page to tidy it away without losing its transactions."
          />
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

      <DeleteNodeDialog
        target={deleting}
        archived
        heldStr={heldStrOf(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
