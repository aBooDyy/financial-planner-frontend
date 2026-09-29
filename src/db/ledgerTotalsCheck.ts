import { db } from './db'
import type { LocalLedgerTotal, LocalTransaction } from './types'
import {
  accumulate,
  sameTotals,
  totalsOf,
} from '#/features/transactions/data/ledgerTotals'

const PAGE_SIZE = 2000

const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0))

// Paged so the recount never holds the main thread for long. Writes landing between pages can
// make it disagree with the stored totals; a disagreement only ever costs a rebuild.
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

/** Recomputes the totals from the whole ledger, atomically with it. */
export async function rebuildLedgerTotals(): Promise<void> {
  await db.transaction('rw', db.transactions, db.ledgerTotals, async () => {
    const rows = await db.transactions.toArray()
    await db.ledgerTotals.clear()
    await db.ledgerTotals.bulkPut(totalsOf(rows))
  })
}

/** Rebuilds the totals if they disagree with the ledger; true when it had to. */
export async function checkLedgerTotals(): Promise<boolean> {
  const recounted = await recountTotals()
  if (sameTotals(recounted, await db.ledgerTotals.toArray())) return false
  await rebuildLedgerTotals()
  return true
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
