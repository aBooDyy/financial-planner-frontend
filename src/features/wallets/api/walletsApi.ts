import { http } from '#/lib/http'
import type { UpdateRateWire } from '#/features/settings/api/types'
import type {
  BalanceNode,
  BalanceNodeWire,
  BalanceSettings,
  BalanceSettingsWire,
  CreateNodeWire,
  ExchangeRate,
  ExchangeRateWire,
  UpdateNodeWire,
  UpdateSettingsWire,
} from './types'
import { toNode, toRate, toSettings } from './types'

/**
 * Remote calls for the wallet entities (balance nodes, settings, rates). The sync engine owns when these run; UI code
 * reads from the local DB, never from here directly.
 */
export const walletsApi = {
  listNodes: (): Promise<BalanceNode[]> =>
    http
      .get<BalanceNodeWire[]>('/balance-nodes')
      .then((rows) => rows.map(toNode)),

  createNode: (payload: CreateNodeWire): Promise<BalanceNode> =>
    http.post<BalanceNodeWire>('/balance-nodes', payload).then(toNode),

  updateNode: (id: string, payload: UpdateNodeWire): Promise<BalanceNode> =>
    http.patch<BalanceNodeWire>(`/balance-nodes/${id}`, payload).then(toNode),

  deleteNode: (id: string): Promise<void> =>
    http.del<void>(`/balance-nodes/${id}`).then(() => undefined),

  getSettings: (): Promise<BalanceSettings> =>
    http.get<BalanceSettingsWire>('/balance-settings').then(toSettings),

  updateSettings: (payload: UpdateSettingsWire): Promise<BalanceSettings> =>
    http
      .patch<BalanceSettingsWire>('/balance-settings', payload)
      .then(toSettings),

  listRates: (): Promise<ExchangeRate[]> =>
    http
      .get<ExchangeRateWire[]>('/exchange-rates')
      .then((rows) => rows.map(toRate)),

  updateRate: (
    currency: string,
    payload: UpdateRateWire,
  ): Promise<ExchangeRate> =>
    http
      .patch<ExchangeRateWire>(`/exchange-rates/${currency}`, payload)
      .then(toRate),
}
