import { useState } from 'react'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import { deliveryPayload } from '#/features/integrations/data/lastPayload'

/**
 * "Build a rule from this": fetch the whole payload a delivery carried (its excerpt, or the
 * import it staged) and hand it to the rule editor.
 */
export function useBuildFromDelivery(
  onPayload: (text: string, delivery: Delivery) => void,
) {
  const [building, setBuilding] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const build = async (delivery: Delivery) => {
    setBuilding(delivery.id)
    setFailed(null)
    try {
      const text = await deliveryPayload(delivery)
      if (text) onPayload(text, delivery)
      else setFailed(delivery.id)
    } catch {
      setFailed(delivery.id)
    } finally {
      setBuilding(null)
    }
  }

  return { building, failed, build }
}
