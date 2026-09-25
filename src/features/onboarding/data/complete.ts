import { pullSettings } from '#/db/sync'
import { authApi } from '#/features/auth/api/authApi'
import type { User } from '#/features/auth/api/types'
import { pullCategories } from '#/features/categories/data/sync'
import { ApiError } from '#/lib/apiError'
import { onboardingApi } from '../api/onboardingApi'
import type { CompleteOnboardingPayload } from '../api/onboardingApi'

const ALREADY_COMPLETED = 'onboarding.already_completed'

async function submit(payload: CompleteOnboardingPayload): Promise<User> {
  try {
    return await onboardingApi.complete(payload)
  } catch (e) {
    // Finished from another tab or device: that setup stands, so carry on with it.
    if (e instanceof ApiError && e.code === ALREADY_COMPLETED) {
      return authApi.me()
    }
    throw e
  }
}

/**
 * Commit the first-run choices, then re-read the two collections the server just rewrote.
 * The pull is best-effort: the regular sync catches up if it fails.
 */
export async function completeOnboarding(
  payload: CompleteOnboardingPayload,
): Promise<User> {
  const user = await submit(payload)
  await Promise.allSettled([pullCategories(), pullSettings()])
  return user
}
