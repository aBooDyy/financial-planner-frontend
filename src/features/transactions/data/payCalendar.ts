import { db } from '#/db/db'
import { SETTINGS_KEY } from '#/db/types'
import { payCalendarOf } from '#/features/planning/data/payPeriods'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { planningSettingsOf } from '#/features/wallets/data/mappers'
import { DEFAULT_BASE_CURRENCY } from '#/features/wallets/constants'
import { mergeRates } from '#/lib/config/rates'

/**
 * The pay calendar per-paycheck budgets reset on: the main paycheck's paydays, or calendar
 * months without one. Read inside a live query, an income or settings edit re-runs it.
 */
export async function readPayCalendar(today: string): Promise<PayCalendar> {
  const [income, settings, rates] = await Promise.all([
    db.incomeStreams.toArray(),
    db.balanceSettings.get(SETTINGS_KEY),
    db.exchangeRates.toArray(),
  ])
  return payCalendarOf(
    income,
    planningSettingsOf(settings),
    settings?.baseCurrency ?? DEFAULT_BASE_CURRENCY,
    mergeRates(rates),
    today,
  )
}
