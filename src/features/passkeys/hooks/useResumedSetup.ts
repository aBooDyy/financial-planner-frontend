import { useEffect, useState } from 'react'
import {
  clearResumeSetup,
  resumeSetupPending,
} from '#/features/passkeys/data/setupFlags'

/**
 * Whether this page was reached coming back from re-verifying with Google to add a passkey.
 * Setup then carries on with one tap rather than by itself: Safari creates a passkey only
 * from a user gesture.
 */
export function useResumedSetup() {
  const [resuming, setResuming] = useState(false)

  useEffect(() => {
    if (!resumeSetupPending()) return
    clearResumeSetup()
    setResuming(true)
  }, [])

  return { resuming, endResume: () => setResuming(false) }
}
