import { useEffect, useRef, useState } from 'react'

/** How long an ignore can still be taken back before it reaches the server. */
export const UNDO_MS = 5000

/** Imports set aside by Ignore / Not a transaction, not yet sent. */
export type HeldBatch = { ids: string[]; skipSimilar: boolean }

/**
 * Ignoring with a way back. The server has no undismiss, so a batch is held here for a few
 * seconds and only sent once that passes, when the next batch is held, or when the review
 * closes — so leaving never loses it. `hidden` covers a batch until the server has answered,
 * so a sent import doesn't flash back before the queue drops it.
 */
export function useHeldBatch(send: (batch: HeldBatch) => Promise<void>) {
  const [held, setHeld] = useState<HeldBatch | null>(null)
  const [sending, setSending] = useState<string[]>([])
  const pending = useRef<HeldBatch | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(true)
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })

  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }

  const flush = () => {
    stop()
    const batch = pending.current
    pending.current = null
    if (!batch) return
    if (mounted.current) setSending((ids) => [...ids, ...batch.ids])
    void sendRef.current(batch).finally(() => {
      if (mounted.current)
        setSending((ids) => ids.filter((id) => !batch.ids.includes(id)))
    })
  }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      flush()
    }
  }, [])

  return {
    held,
    hidden: new Set([...(held?.ids ?? []), ...sending]),
    hold: (batch: HeldBatch) => {
      flush()
      pending.current = batch
      setHeld(batch)
      timer.current = setTimeout(() => {
        flush()
        setHeld(null)
      }, UNDO_MS)
    },
    undo: () => {
      stop()
      pending.current = null
      setHeld(null)
    },
  }
}
