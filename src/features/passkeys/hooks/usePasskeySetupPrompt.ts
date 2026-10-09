import { useEffect, useState } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { passkeysApi } from '#/features/passkeys/api/passkeysApi'
import {
  clearJustSignedIn,
  justSignedIn,
  markPromptDismissed,
  promptDismissed,
} from '#/features/passkeys/data/setupFlags'
import { platformAuthenticatorAvailable } from '#/features/passkeys/passkeySupport'
import { useOnline } from '#/hooks/useOnline'
import { useSessionStore } from '#/stores/session'

/** Outside the app shell: signing in, and first-run setup, which the offer waits out. */
const OUTSIDE_SHELL = ['/auth', '/setup']

const inShell = (pathname: string): boolean =>
  !OUTSIDE_SHELL.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

async function wantsPasskey(): Promise<boolean> {
  if (!(await platformAuthenticatorAvailable())) return false
  return (await passkeysApi.list()).length === 0
}

/**
 * Whether to offer a passkey once, right after a password or Google sign-in (or sign-up):
 * in the app shell, online, on a device that can hold one, for a user who has none and
 * hasn't said "Not now" here. A list that fails to load leaves the offer for the next chance.
 */
export function usePasskeySetupPrompt() {
  const userId = useSessionStore((s) => s.user?.id ?? null)
  const onboarded = useSessionStore((s) => Boolean(s.user?.onboardedAt))
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const online = useOnline()
  const [open, setOpen] = useState(false)
  const ready = onboarded && inShell(pathname) && online

  useEffect(() => {
    if (!userId || !ready || open || !justSignedIn(userId)) return
    if (promptDismissed(userId)) {
      clearJustSignedIn()
      return
    }
    let cancelled = false
    wantsPasskey().then(
      (show) => {
        if (cancelled) return
        clearJustSignedIn()
        setOpen(show)
      },
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [userId, ready, open])

  const dismiss = () => {
    if (userId) markPromptDismissed(userId)
    setOpen(false)
  }

  return { open: open && userId !== null, dismiss }
}
