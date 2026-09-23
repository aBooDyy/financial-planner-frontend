import type { BodyFormat } from '#/features/inbound-imports/api/types'

const NOUN: Record<BodyFormat, string> = { text: 'email', json: 'payload' }

/** What a stored body is called in copy: an inbox row's email, a webhook row's payload. */
export const bodyNoun = (format: BodyFormat): string => NOUN[format]

/** Where a ledger entry came from, read off its `source` marker. */
export type LedgerSource =
  | { kind: 'email'; connectionId: string }
  /** `keyId` is null once the key is deleted — the entry still came from a webhook. */
  | { kind: 'webhook'; keyId: string | null }

/**
 * `email:<connection id>` or `webhook:<key id>` (a bare `webhook:` after the key is gone).
 * Anything else — a manual entry, a CSV import — did not come through the review queue.
 */
export function ledgerSourceOf(
  source: string | null | undefined,
): LedgerSource | null {
  if (!source) return null
  if (source.startsWith('email:')) {
    return { kind: 'email', connectionId: source.slice('email:'.length) }
  }
  if (source.startsWith('webhook:')) {
    return { kind: 'webhook', keyId: source.slice('webhook:'.length) || null }
  }
  return null
}
