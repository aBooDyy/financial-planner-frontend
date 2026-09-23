import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { MerchantView } from '#/features/merchants/hooks/useMerchants'
import { messageForApiError } from '#/lib/errorMessages'

type Props = {
  source: MerchantView
  candidates: MerchantView[]
  /** Pre-picked when a suggestion opened this; the user still confirms. */
  initialTargetId?: string | null
  onMerge: (targetId: string) => Promise<void>
  onClose: () => void
}

/**
 * Fold one merchant into another. The server does the repointing in one transaction, so this
 * needs a connection — failures are surfaced rather than queued.
 */
export function MergeMerchantDialog({
  source,
  candidates,
  initialTargetId = null,
  onMerge,
  onClose,
}: Props) {
  const [targetId, setTargetId] = useState(
    initialTargetId !== null ? initialTargetId : (candidates[0]?.id ?? ''),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = candidates.find((c) => c.id === targetId) ?? null

  const submit = () => {
    if (!targetId || busy) return
    setBusy(true)
    setError(null)
    void onMerge(targetId)
      .then(onClose)
      .catch((e: unknown) => {
        setError(messageForApiError(e))
        setBusy(false)
      })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={`Merge “${source.displayName}”`}
      footer={
        <>
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!targetId || busy}>
            {busy ? 'Merging…' : 'Merge'}
          </Button>
        </>
      }
      contentClassName="sm:max-w-[430px]"
    >
      <div className="flex flex-col gap-[13px]">
        <p className="text-[13px] text-fp-text-2">
          Its spellings and transactions move to the merchant you pick, and “
          {source.displayName}” is removed.
        </p>
        {candidates.length === 0 ? (
          <p className="text-[13px] text-fp-text-3">
            There is no other merchant to merge into yet.
          </p>
        ) : (
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger aria-label="Merge into">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {target ? (
          <p className="text-[12.5px] text-fp-text-3">
            {source.aliases.length + target.aliases.length} spellings will point
            at “{target.displayName}”.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[12.5px] text-fp-danger">
            {error}
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
