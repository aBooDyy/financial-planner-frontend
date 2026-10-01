import { http } from '#/lib/http'
import type { Bill, BillWire, CreateBillWire, UpdateBillWire } from './types'
import { toBill } from './types'

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
}
