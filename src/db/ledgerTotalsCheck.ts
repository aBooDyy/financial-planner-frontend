import { db } from './db'
import type { LocalLedgerTotal, LocalTransaction } from './types'
import {
  accumulate,
  sameTotals,
  totalsOf,
} from '#/features/transactions/data/ledgerTotals'

const PAGE_SIZE = 2000

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0))

// Paged so the recount never holds the main thread for long. A write landing between pages
// can make it disagree with totals that are right, so a disagreement is only a reason to look
// again atomically.
async function recountTotals(): Promise<LocalLedgerTotal[]> {
  const totals = new Map<string, LocalLedgerTotal>()
  let after: string | undefined
  for (;;) {
    const page: LocalTransaction[] = await (
      after === undefined
        ? db.transactions.orderBy(':id')
        : db.transactions.where(':id').above(after)
    )
      .limit(PAGE_SIZE)
      .toArray()
    accumulate(totals, page)
    if (page.length < PAGE_SIZE) return [...totals.values()]
    after = page[page.length - 1].id
    await yieldToMain()
  }
}

/**
 * Recomputes the totals from the whole ledger in one transaction with it, and rewrites them
 * only if they differ; true when they did.
 */
export async function rebuildLedgerTotals(): Promise<boolean> {
  return db.transaction('rw', db.transactions, db.ledgerTotals, async () => {
    const rebuilt = totalsOf(await db.transactions.toArray())
    if (sameTotals(rebuilt, await db.ledgerTotals.toArray())) return false
    await db.ledgerTotals.clear()
    await db.ledgerTotals.bulkPut(rebuilt)
    return true
  })
}

/** Rebuilds the totals if they disagree with the ledger; true when they did. */
export async function checkLedgerTotals(): Promise<boolean> {
  const recounted = await recountTotals()
  if (sameTotals(recounted, await db.ledgerTotals.toArray())) return false
  return rebuildLedgerTotals()
}

let checked = false

/** Runs `checkLedgerTotals` once per page load, when the browser is idle. */
export function scheduleLedgerTotalsCheck(): void {
  if (checked) return
  checked = true
  const run = () => {
    void checkLedgerTotals().then((rebuilt) => {
      if (rebuilt)
        console.warn('Ledger totals disagreed with the ledger; rebuilt')
    })
  }
  if ('requestIdleCallback' in window) requestIdleCallback(run)
  else setTimeout(run, 0)
}
