import type { LocalIntegrationKey } from '#/db/types'
import { formatDate, formatRelativeTime } from '#/lib/date'
import type { DateFormat } from '#/lib/date'
import { HEALTH_LABEL, keyHealth } from './health'

type Context = {
  walletName: string | null
  locale: string
  dateFormat: DateFormat
  now?: Date
}

/**
 * A key's identity in plain words — status, account, expiry, last use. The user does not care
 * about a key; they care which app it is and whether it is working.
 */
export function describeKey(
  key: LocalIntegrationKey,
  { walletName, locale, dateFormat, now = new Date() }: Context,
): string[] {
  const health = keyHealth(key, now)
  const expiresOn = key.expiresAt
    ? formatDate(new Date(key.expiresAt), dateFormat)
    : null

  if (health === 'expired') {
    return [`Expired ${expiresOn} — this key no longer accepts transactions`]
  }

  const parts = [HEALTH_LABEL[health]]
  if (health === 'revoked') {
    parts.push(requests(key.requestsCount))
    return parts
  }
  if (walletName) parts.push(walletName)
  if (health === 'expiring' && key.expiresAt) {
    parts.push(`expires ${inDays(key.expiresAt, locale, now)}`)
  } else if (expiresOn) {
    parts.push(`expires ${expiresOn}`)
  }
  parts.push(
    key.lastUsedAt
      ? `last used ${formatRelativeTime(key.lastUsedAt, locale, now)}`
      : 'not used yet',
  )
  return parts
}

const DAY_MS = 24 * 3600 * 1000

/** Counted in days: "next week" is too vague for a key that is about to stop working. */
const inDays = (iso: string, locale: string, now: Date): string =>
  new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS),
    'day',
  )

const requests = (n: number): string =>
  n === 1 ? '1 request' : `${n.toLocaleString()} requests`

export const ruleCountLabel = (n: number): string =>
  n === 0 ? 'No rules' : n === 1 ? '1 rule' : `${n} rules`
