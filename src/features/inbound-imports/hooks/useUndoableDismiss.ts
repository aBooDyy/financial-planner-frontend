import { useEffect, useRef, useState } from 'react'

/** How long "Not a transaction" can still be taken back before it reaches the server. */
export const DISMISS_UNDO_MS = 5000

/**
 * "Not a transaction" with a way back. The server has no undismiss, so the dismissal is held
 * locally for a few seconds and only sent once that passes — or at once when the row goes away
 * (the review closes), so leaving never loses it.
 */
export function useUndoableDismiss(dismiss: () => Promise<boolean>) {
  const [held, setHeld] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const send = useRef(dismiss)
  useEffect(() => {
    send.current = dismiss
  })

  const commit = async () => {
    timer.current = null
    // On success the row leaves the queue; on failure it comes back with the reason.
    if (!(await send.current())) setHeld(false)
  }

  useEffect(
    () => () => {
      if (timer.current === null) return
      clearTimeout(timer.current)
      timer.current = null
      void send.current()
    },
    [],
  )

  return {
    held,
    start: () => {
      setHeld(true)
      timer.current = setTimeout(() => void commit(), DISMISS_UNDO_MS)
    },
    undo: () => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
      setHeld(false)
    },
  }
}
