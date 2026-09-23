import type { LocalIntegrationKey } from '#/db/types'

/**
 * The sentence a throttled key's row carries, or null while the key is within its quota. The
 * server says until when; the window may have rolled since the list was fetched. A window is
 * one minute, so the wait is always spoken in seconds.
 */
export function throttleNotice(
  key: Pick<LocalIntegrationKey, 'throttledUntil' | 'rateLimitPerMinute'>,
  locale: string,
  now: Date = new Date(),
): string | null {
  if (!key.throttledUntil) return null
  const wait = Math.ceil(
    (new Date(key.throttledUntil).getTime() - now.getTime()) / 1000,
  )
  if (!(wait > 0)) return null
  const resumes = new Intl.RelativeTimeFormat(locale, {
    numeric: 'auto',
  }).format(wait, 'second')
  return `Over its limit of ${key.rateLimitPerMinute} a minute — requests are refused, accepted again ${resumes}.`
}
