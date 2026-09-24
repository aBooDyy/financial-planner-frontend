import type { ChangesPage, ChangesQuery, ChangesWire } from '#/db/changes'
import { changesPath, toChangesPage } from '#/db/changes'
import { http } from '#/lib/http'
import type {
  BulkCreatePlannedWire,
  BulkPlannedResult,
  CreatePlannedWire,
  Planned,
  PlannedWire,
  UpdatePlannedWire,
} from './types'
import { toBulkPlannedResult, toPlanned } from './types'

/**
 * Remote calls for planned transactions. The sync engine owns when these run; the UI reads
 * the local DB, never this.
 */
export const plannedApi = {
  list: (): Promise<Planned[]> =>
    http
      .get<PlannedWire[]>('/planned-transactions')
      .then((rows) => rows.map(toPlanned)),
  /** One page of the delta stream — what the sync engine reads instead of `list`. */
  changes: (query: ChangesQuery): Promise<ChangesPage<Planned>> =>
    http
      .get<
        ChangesWire<PlannedWire>
      >(changesPath('/planned-transactions', query))
      .then((w) => toChangesPage(w, toPlanned)),
  create: (payload: CreatePlannedWire): Promise<Planned> =>
    http.post<PlannedWire>('/planned-transactions', payload).then(toPlanned),
  /** The generator's first run on an account creates dozens at once. */
  bulkCreate: (
    items: ReadonlyArray<CreatePlannedWire>,
  ): Promise<BulkPlannedResult[]> =>
    http
      .post<BulkCreatePlannedWire>('/planned-transactions/bulk', { items })
      .then((r) => r.results.map(toBulkPlannedResult)),
  update: (id: string, payload: UpdatePlannedWire): Promise<Planned> =>
    http
      .patch<PlannedWire>(`/planned-transactions/${id}`, payload)
      .then(toPlanned),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/planned-transactions/${id}`).then(() => undefined),
}
