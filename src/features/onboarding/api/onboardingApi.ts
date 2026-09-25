import { toUser } from '#/features/auth/api/types'
import type { User, UserWire } from '#/features/auth/api/types'
import { http } from '#/lib/http'
import type { CurrencyCode } from '#/lib/currency'

export type CompleteOnboardingPayload = {
  name: string
  baseCurrency: CurrencyCode
  /** Default top-level category slugs to keep; every other default is removed. */
  categories: string[]
}

export const onboardingApi = {
  complete: (payload: CompleteOnboardingPayload): Promise<User> =>
    http
      .post<UserWire>('/onboarding', {
        name: payload.name,
        base_currency: payload.baseCurrency,
        categories: payload.categories,
      })
      .then(toUser),
}
