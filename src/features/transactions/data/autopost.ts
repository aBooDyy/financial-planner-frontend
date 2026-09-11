import { db } from '#/db/db'
import { advanceDue, midnight, parseISO } from './planning'
import { advanceRecurring, createTransaction } from './mutations'

/**
 * Catch-up auto-posting: for each recurring item flagged `autopost` whose `next_due` has
 * arrived, post a real transaction for each missed occurrence and advance the schedule. Runs
 * once when the Spending page mounts.
 *
 * Idempotency is by a `source` marker (`recurring:<id>:<dueDate>`): we never post the same
 * occurrence twice on this device, and after a sync other devices see the posted rows. Two
 * devices posting the very same occurrence before they sync can still double up — an accepted
 * trade-off for a local-first app (a server-side de-dupe could tighten this later).
 */
const MAX_CATCH_UP = 60 // guard against a runaway loop on a far-past due date

const markerFor = (recurringId: string, due: string): string =>
  `recurring:${recurringId}:${due}`

export async function runAutoPost(today: Date): Promise<void> {
  const recurrings = (await db.recurrings.toArray()).filter(
    (r) => r.deleted === 0 && r.autopost,
  )
  if (recurrings.length === 0) return

  const postedMarkers = new Set(
    (await db.transactions.toArray())
      .filter((t) => t.deleted === 0 && t.source)
      .map((t) => t.source as string),
  )

  for (const r of recurrings) {
    let due = r.nextDue
    let posted = false
    let guard = 0
    while (midnight(parseISO(due)) <= midnight(today) && guard < MAX_CATCH_UP) {
      const marker = markerFor(r.id, due)
      if (!postedMarkers.has(marker)) {
        await createTransaction({
          type: r.type,
          amount: r.amount,
          currency: r.currency,
          category: r.category,
          subcategory: r.subcategory,
          walletId: r.walletId,
          goalId: r.goalId,
          date: due,
          note: r.name,
          source: marker,
        })
        postedMarkers.add(marker)
      }
      due = advanceDue(due, r.frequency)
      posted = true
      guard += 1
    }
    if (posted && due !== r.nextDue) await advanceRecurring(r.id, due)
  }
}
