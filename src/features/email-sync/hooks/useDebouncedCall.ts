import { useEffect, useMemo, useRef, useState } from 'react'
import { messageForApiError } from '#/lib/errorMessages'

export const DEBOUNCE_MS = 300

export type DebouncedCall<T> = {
  result: T | null
  /** The request `result` answers. */
  answered: string | null
  pending: boolean
  error: string | null
}

const IDLE = {
  result: null,
  answered: null,
  pending: false,
  error: null,
} as const

/**
 * A server read that follows an editor: re-sent once per burst of edits, the latest request
 * wins, and the previous answer stays on screen while the next one is on its way. A null
 * request clears it.
 */
export function useDebouncedCall<TRequest, T>(
  request: TRequest | null,
  call: (request: TRequest) => Promise<T>,
  enabled: boolean,
): DebouncedCall<T> {
  const [state, setState] = useState<DebouncedCall<T>>(IDLE)
  const latest = useRef(0)
  const callRef = useRef(call)
  callRef.current = call
  // Keyed on the request's identity, so a caller that memoises it pays for one serialisation
  // per change rather than one per render.
  const signature = useMemo(
    () => (request === null ? null : JSON.stringify(request)),
    [request],
  )

  useEffect(() => {
    const ticket = (latest.current += 1)
    if (!enabled || signature === null) {
      setState(IDLE)
      return
    }
    setState((s) => ({ ...s, pending: true }))
    const current = JSON.parse(signature) as TRequest
    const timer = setTimeout(() => {
      callRef.current(current).then(
        (result) => {
          if (ticket !== latest.current) return
          setState({ result, answered: signature, pending: false, error: null })
        },
        (error: unknown) => {
          if (ticket !== latest.current) return
          setState({
            result: null,
            answered: signature,
            pending: false,
            error: messageForApiError(error),
          })
        },
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [signature, enabled])

  return state
}
