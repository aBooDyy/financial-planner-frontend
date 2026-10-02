import type { EntityTable } from 'dexie'

/**
 * Store the row a push was answered with. While more writes for the row wait in the outbox the
 * local row already shows them — an edit, or an action's effect such as a close or a release —
 * so it keeps its fields, stays dirty and takes only the server's version for the next push to
 * build on. Storing the answer whole would undo the queued change until it lands, and for as
 * long as the server keeps refusing it.
 */
export async function storeAnswer<T extends { id: string; version: string }>(
  table: EntityTable<T, 'id'>,
  answer: T,
  stillQueued: boolean,
): Promise<void> {
  const kept =
    stillQueued &&
    (await table.update(answer, (row) => {
      row.version = answer.version
    })) > 0
  if (!kept) await table.put(answer)
}
