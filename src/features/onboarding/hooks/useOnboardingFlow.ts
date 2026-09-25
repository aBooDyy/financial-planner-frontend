import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { User } from '#/features/auth/api/types'
import { messageForApiError } from '#/lib/errorMessages'
import { useSessionStore } from '#/stores/session'
import { completeOnboarding } from '../data/complete'
import { firstNameOf } from '../data/name'
import { LAST_STEP, useOnboardingDraft } from '../stores/onboardingDraft'
import type { OnboardingStep } from '../stores/onboardingDraft'
import { useCategorySelection } from './useCategorySelection'

/** The steps with a progress segment; the last one is the welcome screen. */
export const PROGRESS_STEPS = 5
const FINISH_STEP: OnboardingStep = 5

function ctaLabelFor(
  step: OnboardingStep,
  d: { intents: number; selected: number; currency: string; hasInbox: boolean },
): string {
  switch (step) {
    case 2:
      return d.intents > 0 ? 'Continue' : 'Skip for now'
    case 3:
      return `Use these ${d.selected} categories`
    case 4:
      return `Continue with ${d.currency}`
    case 5:
      return d.hasInbox ? 'Finish setup' : 'Not now, finish setup'
    case 6:
      return 'Open Means'
    default:
      return 'Continue'
  }
}

/**
 * Drives the wizard: which step shows, what the footer button says and does, and the
 * commit on the last input step. The draft is (re)started for whoever is signed in, with
 * their account name — from sign-up or from Google — already filled in.
 */
export function useOnboardingFlow(user: User, hasInbox: boolean) {
  const navigate = useNavigate()
  const setUser = useSessionStore((s) => s.setUser)
  const draft = useOnboardingDraft()
  const { selected } = useCategorySelection()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { userId, start } = draft
  useEffect(() => {
    if (userId !== user.id) start(user.id, user.name)
  }, [userId, start, user.id, user.name])

  const step = draft.step
  const name = draft.name.trim()
  const disabled =
    busy || (step === 1 && !name) || (step === 3 && selected.length === 0)

  const finish = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const updated = await completeOnboarding({
        name,
        baseCurrency: draft.currency,
        categories: selected,
      })
      // Step first: the session update is what marks the user onboarded.
      draft.goTo(LAST_STEP)
      setUser(updated)
    } catch (e) {
      setError(messageForApiError(e))
    } finally {
      setBusy(false)
    }
  }, [draft, name, selected, setUser])

  const openApp = useCallback(async () => {
    await navigate({ to: '/balances' })
    draft.clear()
  }, [draft, navigate])

  const next = useCallback(() => {
    if (disabled) return
    setError(null)
    if (step === FINISH_STEP) return void finish()
    if (step === LAST_STEP) return void openApp()
    draft.goTo((step + 1) as OnboardingStep)
  }, [disabled, draft, finish, openApp, step])

  const back = useCallback(() => {
    if (step <= 1 || step >= LAST_STEP || busy) return
    setError(null)
    draft.goTo((step - 1) as OnboardingStep)
  }, [busy, draft, step])

  return {
    step,
    firstName: firstNameOf(draft.name),
    canGoBack: step > 1 && step < LAST_STEP,
    showProgress: step <= PROGRESS_STEPS,
    cta: {
      label: busy
        ? 'Finishing…'
        : ctaLabelFor(step, {
            intents: draft.intents.length,
            selected: selected.length,
            currency: draft.currency,
            hasInbox,
          }),
      disabled,
    },
    error,
    next,
    back,
  }
}
