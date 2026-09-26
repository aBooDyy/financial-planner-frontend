import { useState } from 'react'
import { Store } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import {
  deleteMerchant,
  mergeMerchants,
  removeMerchantAlias,
  updateMerchant,
} from '#/features/merchants/data/mutations'
import { useMerchants } from '#/features/merchants/hooks/useMerchants'
import { useMergeSuggestions } from '#/features/merchants/hooks/useMergeSuggestions'
import { SectionHeader } from './SectionHeader'
import { MerchantRow } from './MerchantRow'
import { DeleteMerchantDialog } from './DeleteMerchantDialog'
import { MergeMerchantDialog } from './MergeMerchantDialog'
import { MergeSuggestionsCard } from './MergeSuggestionsCard'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

/**
 * The merchant list, most-seen first — a bulk import's near-duplicates surface at the top,
 * where merging them is one click.
 */
export function MerchantsSection() {
  const { merchants } = useMerchants()
  const suggestions = useMergeSuggestions()
  const [merge, setMerge] = useState<{
    sourceId: string
    targetId: string | null
  } | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const merging = merchants.find((m) => m.id === merge?.sourceId) ?? null
  const deleting = merchants.find((m) => m.id === deletingId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Merchants"
        subtitle="Who you pay, and every spelling we recognise them by."
      />

      <MergeSuggestionsCard
        suggestions={suggestions}
        onMerge={(suggestion) =>
          setMerge({
            sourceId: suggestion.source.id,
            targetId: suggestion.target.id,
          })
        }
      />

      <div className={CARD}>
        {merchants.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No merchants yet"
            text="They appear as your transactions are tagged."
          />
        ) : (
          merchants.map((m, i) => (
            <MerchantRow
              key={m.id}
              merchant={m}
              onRename={(displayName) =>
                void updateMerchant(m.id, { displayName })
              }
              onAutoCategorize={(autoCategorize) =>
                void updateMerchant(m.id, { autoCategorize })
              }
              onRemoveAlias={(aliasId) => void removeMerchantAlias(aliasId)}
              onMerge={() => setMerge({ sourceId: m.id, targetId: null })}
              onDelete={() => setDeletingId(m.id)}
              last={i === merchants.length - 1}
            />
          ))
        )}
      </div>

      <DeleteMerchantDialog
        merchant={deleting}
        onClose={() => setDeletingId(null)}
        onConfirm={() => {
          if (deleting) void deleteMerchant(deleting.id)
          setDeletingId(null)
        }}
      />
      {merging ? (
        <MergeMerchantDialog
          key={merging.id}
          source={merging}
          candidates={merchants.filter((m) => m.id !== merging.id)}
          initialTargetId={merge?.targetId ?? null}
          onMerge={(targetId) => mergeMerchants(merging.id, targetId)}
          onClose={() => setMerge(null)}
        />
      ) : null}
    </div>
  )
}
