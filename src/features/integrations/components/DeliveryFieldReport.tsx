import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { Extraction } from '#/features/integrations/api/ruleTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { statusLine } from '#/features/integrations/data/fieldStatus'
import {
  FIELD_META,
  FIELD_ORDER,
} from '#/features/integrations/data/ruleFields'
import { useFieldStatusContext } from '#/features/integrations/hooks/useFieldStatusContext'
import { FieldStatusText } from './FieldStatusText'

type Props = {
  deliveryId: string
  apiKey: IntegrationKey
  walletNames: ReadonlyMap<string, string>
  catalog: CategoryCatalog
  extraction: Extraction
}

/**
 * Each field the rule read, and what it found — the same lines the rule editor shows under a
 * field, so "why did nothing happen" reads exactly like the tester would have said it.
 */
export function DeliveryFieldReport({
  deliveryId,
  apiKey,
  walletNames,
  catalog,
  extraction,
}: Props) {
  const ctx = useFieldStatusContext(
    apiKey,
    walletNames,
    catalog,
    extraction,
    true,
  )
  const fields = FIELD_ORDER.filter(
    (field) =>
      extraction.fields[field] !== undefined ||
      extraction.missing.includes(field),
  )
  if (fields.length === 0) return null

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
      {fields.map((field) => (
        <div key={field} className="contents">
          <dt className="pt-px text-[12.5px] font-semibold text-fp-text-2">
            {FIELD_META[field].label}
          </dt>
          <dd>
            <FieldStatusText
              id={`delivery-${deliveryId}-${field}`}
              status={statusLine(
                field,
                extraction.fields[field] !== undefined,
                ctx,
              )}
            />
          </dd>
        </div>
      ))}
    </dl>
  )
}
