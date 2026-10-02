/**
 * Field-wise rebase after a `409`. Whenever the server's copy of a row is stored, its update
 * body is kept on the local row as `synced` — the base every later local edit starts from. A
 * rebase re-applies only the fields where the user's row differs from that base onto the
 * server's current copy, so a field another device changed meanwhile (a bill's next due date, a
 * stored plan, another planning setting) survives. A row without a base matching its version —
 * stored by a path that keeps none — rebases whole, last write wins.
 */

type Body = Record<string, unknown> & { version: string }
type WithSynced = { synced?: Body }

/** The server's copy, carrying its own update body as the base for later rebases. */
export const withSynced = <T extends object>(
  row: T,
  toBody: (row: T) => Body,
): T => ({ ...row, synced: toBody(row) })

/** The base a row was last synced at, for `storeAnswer` to move along with the version. */
export const syncedOf = (row: object): Body | undefined =>
  (row as WithSynced).synced

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * The body to retry with: the server's current body (`fresh`) with this device's changes on it.
 * `local` is the user's row and `mine` its body; both carry the version the row was synced at.
 */
export function rebasedBody<TBody extends Body>(
  local: object,
  mine: TBody,
  fresh: TBody,
): TBody {
  const base = syncedOf(local)
  if (!base || base.version !== mine.version)
    return { ...mine, version: fresh.version }
  const changed = Object.keys(mine).filter(
    (key) => key !== 'version' && !same(mine[key], base[key]),
  )
  return {
    ...fresh,
    ...Object.fromEntries(changed.map((key) => [key, mine[key]])),
    version: fresh.version,
  }
}
