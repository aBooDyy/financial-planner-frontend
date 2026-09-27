import { History, RefreshCw } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { OfflineNotice } from '#/components/OfflineNotice'
import { Button } from '#/components/ui/button'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { summarizeDelivery } from '#/features/integrations/data/deliveryText'
import { useBuildFromDelivery } from '#/features/integrations/hooks/useBuildFromDelivery'
import { useDeliveries } from '#/features/integrations/hooks/useDeliveries'
import { useConfigLimits } from '#/lib/config/appConfig'
import { SMALL_BUTTON } from './buttonStyles'
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
      className="flex min-w-0 flex-col gap-3 rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface p-[14px]"
    >
      <div>
        <div className="flex items-center gap-2">
          <h3
            id="delivery-log-heading"
            className="flex-1 text-[15px] font-extrabold"
          >
            Recent deliveries
          </h3>
          <Button
            type="button"
            variant="quiet"
            disabled={!online || log.status === 'loading'}
            onClick={log.reload}
            className={`${SMALL_BUTTON} gap-1.5`}
          >
            <RefreshCw size={13} strokeWidth={2.2} />
            Refresh
          </Button>
        </div>
        <p className="mt-[3px] text-[12.5px] leading-[1.45] text-fp-text-2">
          The last 50 requests this key received, including the ones it refused.
        </p>
      </div>

      {log.status === 'offline' ? (
        <OfflineNotice>
          You’re offline. The delivery log needs the server.
        </OfflineNotice>
      ) : log.status === 'failed' ? (
        <p role="alert" className="text-[12.5px] text-fp-danger">
          Couldn’t load the delivery log.
        </p>
      ) : log.deliveries.length === 0 && log.status === 'loading' ? (
        <p className="text-[12.5px] text-fp-text-3">Loading…</p>
      ) : log.deliveries.length === 0 ? (
        <EmptyState
          icon={History}
          size="sm"
          framed
          title="No requests yet"
          text="Send a request from your app and it will show here, whether or not it was accepted."
        />
      ) : (
        <ul aria-label="Deliveries, newest first" className="-mt-1">
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
