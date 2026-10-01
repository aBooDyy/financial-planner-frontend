import { http } from '#/lib/http'
import type { CloseWire } from '#/features/setAsides/api/types'
import type {
  Bill,
  BillWire,
  CloseBillResult,
  CloseBillResultWire,
  CreateBillWire,
  UpdateBillWire,
} from './types'
import { toBill, toCloseBillResult } from './types'

/**
 * Remote calls for bills. The sync engine owns when these run; UI code reads from the local
 * DB, never from here directly.
 */
export const billsApi = {
  list: (): Promise<Bill[]> =>
    http.get<BillWire[]>('/bills').then((rows) => rows.map(toBill)),

  create: (payload: CreateBillWire): Promise<Bill> =>
    http.post<BillWire>('/bills', payload).then(toBill),

  update: (id: string, payload: UpdateBillWire): Promise<Bill> =>
    http.patch<BillWire>(`/bills/${id}`, payload).then(toBill),

  del: (id: string): Promise<void> =>
    http.del<void>(`/bills/${id}`).then(() => undefined),

  close: (
    id: string,
    payload: CloseWire & { version: string },
  ): Promise<CloseBillResult> =>
    http
      .post<CloseBillResultWire>(`/bills/${id}/close`, payload)
      .then(toCloseBillResult),

  reopen: (id: string, payload: { version: string }): Promise<Bill> =>
    http.post<BillWire>(`/bills/${id}/reopen`, payload).then(toBill),
}
