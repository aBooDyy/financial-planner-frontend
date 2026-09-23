import { http } from '#/lib/http'
import type {
  CreateCustomCurrencyWire,
  CustomCurrency,
  CustomCurrencyWire,
  UpdateCustomCurrencyWire,
} from './types'
import { toCustomCurrency } from './types'

/**
 * Remote calls for the user's own currencies. The sync engine owns when these run; UI code
 * reads from the local DB, never from here directly.
 */
export const customCurrenciesApi = {
  list: (): Promise<CustomCurrency[]> =>
    http
      .get<CustomCurrencyWire[]>('/custom-currencies')
      .then((rows) => rows.map(toCustomCurrency)),

  create: (payload: CreateCustomCurrencyWire): Promise<CustomCurrency> =>
    http
      .post<CustomCurrencyWire>('/custom-currencies', payload)
      .then(toCustomCurrency),

  update: (
    id: string,
    payload: UpdateCustomCurrencyWire,
  ): Promise<CustomCurrency> =>
    http
      .patch<CustomCurrencyWire>(`/custom-currencies/${id}`, payload)
      .then(toCustomCurrency),

  remove: (id: string): Promise<void> =>
    http.del<void>(`/custom-currencies/${id}`).then(() => undefined),
}
