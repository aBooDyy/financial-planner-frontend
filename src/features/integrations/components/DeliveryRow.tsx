import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { Delivery } from '#/features/integrations/api/deliveryTypes'
import type { IntegrationKey } from '#/features/integrations/api/types'
import { DELIVERY_TONE_TEXT } from '#/features/integrations/data/deliveryText'
import type {
  DeliverySummary,
  DeliveryTone,
} from '#/features/integrations/data/deliveryText'
import { formatDate, formatRelativeTime } from '#/lib/date'
import { cn } from '#/lib/utils'
import { useDirectionStore } from '#/stores/direction'
import { usePreferencesStore } from '#/stores/preferences'
import { DeliveryDetails } from './DeliveryDetails'

const DOT: Record<DeliveryTone, string> = {
  ok: 'bg-fp-accent',
  warn: 'bg-fp-warn',
  error: 'bg-fp-danger',
  idle: 'border-[1.5px] border-fp-text-3 bg-transparent',
}

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

/** One request: when, what became of it, which rule — and, opened, why. */
export function DeliveryRow({ delivery, summary, ...details }: Props) {
  const [open, setOpen] = useState(false)
  const locale = useDirectionStore((s) => s.locale)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const received = new Date(delivery.receivedAt)
  const exact = `${formatDate(received, dateFormat)} ${received.toLocaleTimeString(locale)}`

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <li className="border-b border-fp-border last:border-b-0">
        <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start hover:bg-fp-surface-2">
          <span
            aria-hidden
            className={cn('h-2 w-2 shrink-0 rounded-full', DOT[summary.tone])}
          />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block text-[13px] font-semibold',
                DELIVERY_TONE_TEXT[summary.tone],
              )}
            >
              {summary.headline}
            </span>
            {delivery.ruleName ? (
              <span className="block truncate text-[12px] text-fp-text-3">
                Rule “<bdi>{delivery.ruleName}</bdi>”
              </span>
            ) : null}
          </span>
          <time
            dateTime={delivery.receivedAt}
            title={exact}
            className="shrink-0 text-[12px] text-fp-text-3"
          >
            {formatRelativeTime(delivery.receivedAt, locale) ?? exact}
          </time>
          <ChevronDown
            aria-hidden
            size={15}
            strokeWidth={2}
            className={cn(
              'shrink-0 text-fp-text-3 transition-transform',
              open && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <DeliveryDetails delivery={delivery} summary={summary} {...details} />
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}
