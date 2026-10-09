import type { Passkey } from '#/features/passkeys/api/types'
import type { DateFormat } from '#/lib/date'
import { formatDate, formatRelativeTime } from '#/lib/date'

/** "Mobile Safari" and "Safari" are one browser to the person reading the row. */
const browserOf = (name: string | null): string | null =>
  name ? name.replace(/^Mobile\s+/, '') : null

/** Where the passkey was made: "iPhone · iOS 18.1 · Safari". Null when the server knew nothing. */
export function deviceLine(passkey: Passkey): string | null {
  const os = passkey.osName
    ? [passkey.osName, passkey.osVersion].filter(Boolean).join(' ')
    : null
  const parts = [passkey.deviceModel, os, browserOf(passkey.browserName)]
  const line = parts.filter(Boolean).join(' · ')
  return line === '' ? null : line
}

export function addedLine(passkey: Passkey, dateFormat: DateFormat): string {
  const added = new Date(passkey.createdAt)
  return Number.isNaN(added.getTime())
    ? 'Added'
    : `Added ${formatDate(added, dateFormat)}`
}

export function lastUsedLine(
  passkey: Passkey,
  locale: string,
  now: Date = new Date(),
): string {
  const when = passkey.lastUsedAt
    ? formatRelativeTime(passkey.lastUsedAt, locale, now)
    : null
  if (!when) return 'Never used'
  return passkey.lastUsedDevice
    ? `Last used ${when} on ${passkey.lastUsedDevice}`
    : `Last used ${when}`
}
