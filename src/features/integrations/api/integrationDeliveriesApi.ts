import { http } from '#/lib/http'
import type { Delivery, DeliveryWire } from './deliveryTypes'
import { toDelivery } from './deliveryTypes'

/**
 * A key's delivery log: its last requests, newest first, refusals included. Only ever read
 * while the key's editor is open, so it is fetched on demand and never cached.
 */
export const integrationDeliveriesApi = {
  list: (keyId: string): Promise<Delivery[]> =>
    http
      .get<
        DeliveryWire[]
      >(`/integration-keys/${encodeURIComponent(keyId)}/deliveries`)
      .then((rows) => rows.map(toDelivery)),
}
