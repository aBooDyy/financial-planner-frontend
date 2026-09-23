import type { ChangesPage, ChangesQuery, ChangesWire } from '#/db/changes'
import { changesPath, toChangesPage } from '#/db/changes'
import { http } from '#/lib/http'
import type {
  AddAliasesWire,
  CreateMerchantWire,
  Merchant,
  MerchantAlias,
  MerchantAliasWire,
  MerchantWire,
  MergeMerchantsWire,
  UpdateMerchantWire,
} from './types'
import { toMerchant, toMerchantAlias } from './types'

/**
 * Remote calls for merchants. The sync engine owns when these run; the UI reads merchants
 * from the local DB and matches against it, never from here directly.
 */
export const merchantsApi = {
  list: (): Promise<Merchant[]> =>
    http.get<MerchantWire[]>('/merchants').then((r) => r.map(toMerchant)),
  /** One page of the merchant delta. Each item carries that merchant's whole alias set. */
  changes: (query: ChangesQuery): Promise<ChangesPage<Merchant>> =>
    http
      .get<ChangesWire<MerchantWire>>(changesPath('/merchants', query))
      .then((w) => toChangesPage(w, toMerchant)),
  /**
   * The aliases' own delta. A spelling can be added to or dropped from a merchant whose
   * own row never changed, so the merchant stream alone would never mention it.
   */
  aliasChanges: (query: ChangesQuery): Promise<ChangesPage<MerchantAlias>> =>
    http
      .get<
        ChangesWire<MerchantAliasWire>
      >(changesPath('/merchant-aliases', query))
      .then((w) => toChangesPage(w, toMerchantAlias)),
  create: (payload: CreateMerchantWire): Promise<Merchant> =>
    http.post<MerchantWire>('/merchants', payload).then(toMerchant),
  update: (id: string, payload: UpdateMerchantWire): Promise<Merchant> =>
    http.patch<MerchantWire>(`/merchants/${id}`, payload).then(toMerchant),
  addAliases: (id: string, payload: AddAliasesWire): Promise<Merchant> =>
    http
      .post<MerchantWire>(`/merchants/${id}/aliases`, payload)
      .then(toMerchant),
  removeAlias: (id: string, aliasId: string): Promise<void> =>
    http.del<void>(`/merchants/${id}/aliases/${aliasId}`).then(() => undefined),
  /** Folds `source_id` into `target_id` server-side and returns the survivor. */
  merge: (payload: MergeMerchantsWire): Promise<Merchant> =>
    http.post<MerchantWire>('/merchants/merge', payload).then(toMerchant),
  remove: (id: string): Promise<void> =>
    http.del<void>(`/merchants/${id}`).then(() => undefined),
}
