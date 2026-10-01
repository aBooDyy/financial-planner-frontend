import { http } from '#/lib/http'
import type {
  CreateSetAsideWire,
  MoveWire,
  ReleaseWire,
  SetAside,
  SetAsideBatch,
  SetAsideBatchWire,
  SetAsideWire,
  UpdateSetAsideWire,
} from './types'
import { toSetAside, toSetAsideBatch } from './types'

/**
 * Remote calls for set-asides. The sync engine owns when these run; UI code reads from the
 * local DB, never from here directly.
 */
export const setAsidesApi = {
  list: (): Promise<SetAside[]> =>
    http
      .get<SetAsideWire[]>('/set-asides')
      .then((rows) => rows.map(toSetAside)),

  create: (payload: CreateSetAsideWire): Promise<SetAside> =>
    http.post<SetAsideWire>('/set-asides', payload).then(toSetAside),

  update: (id: string, payload: UpdateSetAsideWire): Promise<SetAside> =>
    http.patch<SetAsideWire>(`/set-asides/${id}`, payload).then(toSetAside),

  del: (id: string): Promise<void> =>
    http.del<void>(`/set-asides/${id}`).then(() => undefined),

  release: (payload: ReleaseWire): Promise<SetAsideBatch> =>
    http
      .post<SetAsideBatchWire>('/set-asides/release', payload)
      .then(toSetAsideBatch),

  move: (payload: MoveWire): Promise<SetAsideBatch> =>
    http
      .post<SetAsideBatchWire>('/set-asides/move', payload)
      .then(toSetAsideBatch),
}
