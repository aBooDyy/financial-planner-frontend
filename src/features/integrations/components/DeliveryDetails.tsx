import { Wrench } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { canBuildFrom } from '#/features/integrations/data/deliveryText'
import type { DeliverySummary } from '#/features/integrations/data/deliveryText'
import { prettyJson } from '#/features/integrations/data/prettyJson'
import { SMALL_BUTTON, SOFT_BUTTON } from './buttonStyles'
import { DeliveryFieldReport } from './DeliveryFieldReport'

type Props = {
  delivery: Delivery
  summary: DeliverySummary
  apiKey: IntegrationKey
  walletNames: ReadonlyMap<string, string>
  catalog: CategoryCatalog
  online: boolean
  building: boolean
  buildFailed: boolean
  onBuild: () => void
}

const EXCERPT_NOTE =
  'The first 2,000 characters. Building a rule uses the whole payload when it was kept for review.'

/** What arrived, how the rules read it, and the way to a rule that reads it better. */
export function DeliveryDetails({
  delivery,
  summary,
  apiKey,
  walletNames,
  catalog,
  online,
  building,
  buildFailed,
  onBuild,
}: Props) {
  const { report } = delivery
  const failedRules = report?.trace.filter((entry) => !entry.matched) ?? []
  const noRuleFired = report !== null && delivery.ruleId === null

  return (
    <div className="flex flex-col gap-3 ps-[19px] pb-3">
      {summary.help ? (
        <p className="text-[12.5px] leading-relaxed text-fp-text-2">
          {summary.help}
        </p>
      ) : null}

      {noRuleFired && failedRules.length > 0 ? (
        <ul className="flex flex-col gap-1 text-[12.5px] text-fp-text-2">
          {failedRules.map((entry) => (
            <li key={entry.index}>
              Rule {entry.index + 1}, “<bdi>{entry.name}</bdi>”, didn’t match
              {entry.detail ? (
                <>
                  {' '}
                  (
                  <bdi dir="ltr" className="font-mono text-[12px]">
                    {entry.detail}
                  </bdi>
                  )
                </>
              ) : null}
              .
            </li>
          ))}
        </ul>
      ) : null}

      {report ? (
        <DeliveryFieldReport
          deliveryId={delivery.id}
          apiKey={apiKey}
          walletNames={walletNames}
          catalog={catalog}
          extraction={report.result}
        />
      ) : null}

      {delivery.payloadExcerpt !== null ? (
        <div className="flex flex-col gap-1">
          <pre
            dir="ltr"
            className="max-h-[200px] overflow-auto rounded-[12px] bg-fp-surface-2 p-3 text-start font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-fp-text"
          >
            {prettyJson(delivery.payloadExcerpt)}
          </pre>
          {delivery.payloadTruncated ? (
            <p className="text-[12px] text-fp-text-3">{EXCERPT_NOTE}</p>
          ) : null}
        </div>
      ) : delivery.outcome === 'REJECTED' ? (
        <p className="text-[12.5px] text-fp-text-3">
          Nothing it sent is kept — the request didn’t prove it holds this key.
        </p>
      ) : null}

      {canBuildFrom(delivery) ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            disabled={!online || building}
            onClick={onBuild}
            className={`${SMALL_BUTTON} ${SOFT_BUTTON} gap-1.5`}
          >
            <Wrench size={14} strokeWidth={2} />
            {building
              ? 'Loading…'
              : delivery.ruleId
                ? 'Open its rule with this payload'
                : 'Build a rule from this'}
          </Button>
          {buildFailed ? (
            <p role="alert" className="text-[12.5px] text-fp-danger">
              Couldn’t load this payload. Check your connection and try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
