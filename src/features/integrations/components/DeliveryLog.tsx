import { RefreshCw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { summarizeDelivery } from '#/features/integrations/data/deliveryText'
import { useBuildFromDelivery } from '#/features/integrations/hooks/useBuildFromDelivery'
import { useDeliveries } from '#/features/integrations/hooks/useDeliveries'
import { useConfigLimits } from '#/lib/config/appConfig'
import { DeliveryRow } from './DeliveryRow'

type Props = {
  apiKey: IntegrationKey
  online: boolean
  walletNames: ReadonlyMap<string, string>
  catalog: CategoryCatalog
  /** Open the rule editor on this payload. */
  onBuild: (payload: string, delivery: Delivery) => void
}

/**
 * The key's recent requests, refusals included — the answer to "I sent something and nothing
 * happened", and the shortest way from a payload that went wrong to a rule that reads it.
 */
export function DeliveryLog({
  apiKey,
  online,
  walletNames,
  catalog,
  onBuild,
}: Props) {
  const log = useDeliveries(apiKey.id, online)
  const builder = useBuildFromDelivery(onBuild)
  const { integrationPayloadMaxBytes } = useConfigLimits()
  const limits = {
    rateLimitPerMinute: apiKey.rateLimitPerMinute,
    payloadMaxBytes: integrationPayloadMaxBytes,
  }

  return (
    <section
      aria-labelledby="delivery-log-heading"
      aria-busy={log.status === 'loading'}
      className="flex flex-col gap-3 rounded-xl border border-fp-border bg-fp-surface-2 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id="delivery-log-heading" className="text-[14.5px] font-bold">
          Recent deliveries
        </h3>
        <Button
          type="button"
          variant="outline"
          disabled={!online || log.status === 'loading'}
          onClick={log.reload}
          className="gap-1.5 bg-fp-surface px-3 py-[7px] text-[12.5px] font-semibold"
        >
          <RefreshCw size={13} strokeWidth={2} />
          Refresh
        </Button>
      </div>
      <p className="text-[12.5px] leading-relaxed text-fp-text-2">
        The last 50 requests this key received, including the ones it refused.
      </p>

      {log.status === 'offline' ? (
        <p className="text-[12.5px] text-fp-text-3">
          You’re offline. The delivery log needs the server.
        </p>
      ) : log.status === 'failed' ? (
        <p role="alert" className="text-[12.5px] text-fp-danger">
          Couldn’t load the delivery log.
        </p>
      ) : log.deliveries.length === 0 ? (
        <p className="text-[12.5px] text-fp-text-3">
          {log.status === 'loading'
            ? 'Loading…'
            : 'Nothing yet. Send a request from your app and it will show here, whether or not it was accepted.'}
        </p>
      ) : (
        <ul
          aria-label="Deliveries, newest first"
          className="overflow-hidden rounded-xl border border-fp-border bg-fp-surface"
        >
          {log.deliveries.map((delivery) => (
            <DeliveryRow
              key={delivery.id}
              delivery={delivery}
              summary={summarizeDelivery(delivery, limits)}
              apiKey={apiKey}
              walletNames={walletNames}
              catalog={catalog}
              online={online}
              building={builder.building === delivery.id}
              buildFailed={builder.failed === delivery.id}
              onBuild={() => void builder.build(delivery)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
