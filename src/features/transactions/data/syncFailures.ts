import type { OutboxEntity } from '#/db/types'
import type { SyncFailureContext } from '#/lib/syncFailureMessages'
import { DELETED_ACCOUNT } from './selectors'
import type { ActivityRow } from './selectors'

/** The outbox entities a ledger row's changes travel as; a transfer's by its `transferId`. */
export const LEDGER_SYNC_ENTITIES: ReadonlyArray<OutboxEntity> = [
  'transaction',
  'transfer',
]

/** The entity a row's changes are queued as: a transfer row's id is its transfer id. */
export const syncEntityOf = (row: ActivityRow): OutboxEntity =>
  row.kind === 'transfer'
    ? 'transfer'
    : row.kind === 'set_aside'
      ? 'allocation'
      : 'transaction'

const known = (name: string): string | null =>
  name && name !== DELETED_ACCOUNT ? name : null

/** The names a row already shows, for a failure message that can say which one. */
export function syncContextOf(row: ActivityRow): SyncFailureContext {
  switch (row.kind) {
    case 'tx':
      return {
        wallet: known(row.walletPath.join(' · ')),
        category: row.catPath.join(' · '),
      }
    case 'adjustment':
      return { wallet: known(row.walletName) }
    case 'transfer':
      return {
        fromWallet: known(row.fromName),
        toWallet: known(row.toName),
      }
    case 'set_aside':
      return { goal: row.name }
  }
}
