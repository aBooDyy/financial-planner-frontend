import { useCallback, useEffect, useState } from 'react'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import { integrationDeliveriesApi } from '#/features/integrations/api/integrationDeliveriesApi'

type DeliveriesModel = {
  status: 'loading' | 'ready' | 'failed' | 'offline'
  deliveries: Delivery[]
  reload: () => void
}

/** A key's delivery log, read when its editor opens and again on request. */
export function useDeliveries(keyId: string, online: boolean): DeliveriesModel {
  const [loads, setLoads] = useState(0)
  const [result, setResult] = useState<{
    keyId: string
    load: number
    deliveries: Delivery[] | null
  } | null>(null)

  useEffect(() => {
    if (!online) return
    let active = true
    integrationDeliveriesApi.list(keyId).then(
      (deliveries) => active && setResult({ keyId, load: loads, deliveries }),
      () => active && setResult({ keyId, load: loads, deliveries: null }),
    )
    return () => {
      active = false
    }
  }, [keyId, online, loads])

  const reload = useCallback(() => setLoads((n) => n + 1), [])
  const ours = result?.keyId === keyId ? result : null
  const settled = ours?.load === loads ? ours : null

  return {
    status: !online
      ? 'offline'
      : settled === null
        ? 'loading'
        : settled.deliveries === null
          ? 'failed'
          : 'ready',
    // A reload keeps this key's rows on screen until the new ones arrive.
    deliveries: ours?.deliveries ?? [],
    reload,
  }
}
