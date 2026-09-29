import Dexie from 'dexie'
import type {
  DBCore,
  DBCoreDeleteRequest,
  DBCoreMutateRequest,
  DBCoreMutateResponse,
  DBCorePutRequest,
  DBCoreTable,
  DBCoreTransaction,
  Middleware,
} from 'dexie'
import type { LocalLedgerTotal, LocalTransaction } from './types'
import {
  applyTotalsDiff,
  totalsDiff,
} from '#/features/transactions/data/ledgerTotals'

export const LEDGER_TABLE = 'transactions'
export const TOTALS_TABLE = 'ledgerTotals'

// Dexie's RangeType.Any — the range `Table.clear()` deletes.
const WHOLE_TABLE = 3

const holdsTotals = (trans: DBCoreTransaction): boolean =>
  (trans as unknown as IDBTransaction).objectStoreNames.contains(TOTALS_TABLE)

const succeeded = <T>(items: ReadonlyArray<T>, res: DBCoreMutateResponse) =>
  res.numFailures === 0 ? items : items.filter((_, i) => !(i in res.failures))

const present = (rows: ReadonlyArray<LocalTransaction | undefined>) =>
  rows.filter((r): r is LocalTransaction => r !== undefined)

/**
 * Keeps `ledgerTotals` in step with `transactions` inside the same IndexedDB transaction as
 * every write, whichever code path makes it. Write transactions on the ledger are widened to
 * include the totals, so callers never list them. Writes within one transaction are applied
 * one after another: each reads the totals the previous one wrote.
 *
 * Chains stay on the promises Dexie returns rather than `async`/`await`: the layers below read
 * the current transaction from Dexie's zone, which only its own promises carry through.
 */
export const ledgerTotalsMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'LedgerTotals',
  create: (down) => {
    if (!down.schema.tables.some((t) => t.name === TOTALS_TABLE)) return {}
    const queues = new WeakMap<DBCoreTransaction, Promise<unknown>>()

    const inTurn = <T>(
      trans: DBCoreTransaction,
      run: () => Promise<T>,
    ): Promise<T> => {
      const next = (queues.get(trans) ?? Dexie.Promise.resolve()).then(run)
      queues.set(
        trans,
        next.catch(() => undefined),
      )
      return next
    }

    const withTotals = (ledger: DBCoreTable): DBCoreTable => {
      const totals = down.table(TOTALS_TABLE)
      const keysOf = (
        req: DBCorePutRequest | DBCoreDeleteRequest,
      ): unknown[] =>
        req.type === 'delete'
          ? req.keys
          : (req.keys ??
            req.values.map((v) => ledger.schema.primaryKey.extractKey!(v)))

      const rowsBefore = (
        req: DBCoreMutateRequest,
      ): Promise<Array<LocalTransaction | undefined>> => {
        if (req.type === 'add') return Dexie.Promise.resolve([])
        if (req.type === 'deleteRange')
          return ledger
            .query({
              trans: req.trans,
              values: true,
              query: { index: ledger.schema.primaryKey, range: req.range },
            })
            .then(({ result }) => result as LocalTransaction[])
        return ledger.getMany({ trans: req.trans, keys: keysOf(req) })
      }

      const moveTotals = (
        trans: DBCoreTransaction,
        before: ReadonlyArray<LocalTransaction>,
        after: ReadonlyArray<LocalTransaction>,
      ): Promise<unknown> => {
        const diff = totalsDiff(before, after)
        if (diff.length === 0) return Dexie.Promise.resolve()
        return totals
          .getMany({ trans, keys: diff.map((d) => d.id) })
          .then((stored: Array<LocalLedgerTotal | undefined>) => {
            const { put, remove } = applyTotalsDiff(stored, diff)
            return (
              put.length > 0
                ? totals.mutate({ trans, type: 'put', values: put })
                : Dexie.Promise.resolve()
            ).then(() =>
              remove.length > 0
                ? totals.mutate({ trans, type: 'delete', keys: remove })
                : undefined,
            )
          })
      }

      const mutate = (
        req: DBCoreMutateRequest,
      ): Promise<DBCoreMutateResponse> => {
        if (req.type === 'deleteRange' && req.range.type === WHOLE_TABLE)
          return ledger
            .mutate(req)
            .then((res) =>
              totals
                .mutate({
                  trans: req.trans,
                  type: 'deleteRange',
                  range: req.range,
                })
                .then(() => res),
            )
        return rowsBefore(req).then((before) =>
          ledger.mutate(req).then((res) => {
            const after =
              req.type === 'add' || req.type === 'put' ? req.values : []
            return moveTotals(
              req.trans,
              present(
                req.type === 'deleteRange' ? before : succeeded(before, res),
              ),
              present(succeeded(after, res) as LocalTransaction[]),
            ).then(() => res)
          }),
        )
      }

      return {
        ...ledger,
        mutate: (req) =>
          holdsTotals(req.trans)
            ? inTurn(req.trans, () => mutate(req))
            : ledger.mutate(req),
      }
    }

    return {
      transaction: (stores, mode, options) =>
        down.transaction(
          mode === 'readwrite' &&
            stores.includes(LEDGER_TABLE) &&
            !stores.includes(TOTALS_TABLE)
            ? [...stores, TOTALS_TABLE]
            : stores,
          mode,
          options,
        ),
      table: (name) =>
        name === LEDGER_TABLE ? withTotals(down.table(name)) : down.table(name),
    }
  },
}
