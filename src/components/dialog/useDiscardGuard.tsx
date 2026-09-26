import { useState } from 'react'
import type { ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

type Options = {
  /** Whether closing now would lose edits. */
  dirty: boolean
  close: () => void
  /** What closing loses ("You changed the amount of Rent. Closing now loses it."). */
  message?: ReactNode
}

/**
 * Guards an editor's close behind "Discard your changes?" while it has edits. Route every way
 * out (close button, Esc, backdrop, Cancel) through `requestClose` and render `prompt`.
 */
export function useDiscardGuard({ dirty, close, message }: Options) {
  const [asking, setAsking] = useState(false)

  const requestClose = () => {
    if (dirty) setAsking(true)
    else close()
  }

  const prompt = (
    <ConfirmDialog
      open={asking}
      onOpenChange={setAsking}
      tone="warn"
      title="Discard your changes?"
      cancelLabel="Keep editing"
      confirmLabel="Discard"
      onConfirm={() => {
        setAsking(false)
        close()
      }}
    >
      <p>{message ?? 'Closing now loses the changes you made.'}</p>
    </ConfirmDialog>
  )

  return { requestClose, prompt }
}
