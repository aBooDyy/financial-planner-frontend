import { useState } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { NoteBox } from '#/components/dialog/NoteBox'
import { FormRow } from '#/components/FormRow'
import { OFFLINE_HINT } from '#/components/OfflineNotice'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { MerchantView } from '#/features/merchants/hooks/useMerchants'
import { useOnline } from '#/hooks/useOnline'
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
  const online = useOnline()

  const target = candidates.find((c) => c.id === targetId) ?? null

  const submit = () => {
    if (!targetId || busy || !online) return
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
      description={`Its spellings and transactions move to the merchant you pick, and “${source.displayName}” is removed.`}
      footer={
        <DialogActions
          hint={online ? null : `Merging needs a connection. ${OFFLINE_HINT}`}
          onCancel={onClose}
          submitLabel={busy ? 'Merging…' : 'Merge'}
          onSubmit={submit}
          disabled={!targetId || busy || !online}
        />
      }
      contentClassName="sm:max-w-[430px]"
    >
      {candidates.length === 0 ? (
        <NoteBox tone="neutral">
          There is no other merchant to merge into yet.
        </NoteBox>
      ) : (
        <FormRow id="merge-target" label="Merge into which merchant?">
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="merge-target" aria-label="Merge into">
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
        </FormRow>
      )}
      {target ? (
        <NoteBox>
          {source.aliases.length + target.aliases.length} spellings will point
          at “{target.displayName}”.
        </NoteBox>
      ) : null}
      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-fp-danger">
          {error}
        </p>
      ) : null}
    </ResponsiveDialog>
  )
}
