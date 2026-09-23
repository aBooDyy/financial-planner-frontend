import { useEffect, useRef, useState } from 'react'

const COPIED_FOR_MS = 2000

/** Copy text to the clipboard; `copied` stays true briefly so the button can say so. */
export function useCopy(): {
  copied: boolean
  failed: boolean
  copy: (text: string) => Promise<boolean>
} {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setFailed(true)
      return false
    }
    setFailed(false)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_FOR_MS)
    return true
  }

  return { copied, failed, copy }
}
