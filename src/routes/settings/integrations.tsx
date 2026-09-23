import { createFileRoute } from '@tanstack/react-router'
import { IntegrationsSection } from '#/features/integrations/components/IntegrationsSection'
import { isUuid } from '#/lib/uuid'

export type IntegrationsSearch = {
  /** `?key=<id>` — open that key's editor. */
  key?: string
  /** `?sample=<import id>` — with `key`, preload that staged import's payload as the rule sample. */
  sample?: string
}

const idParam = (value: unknown): string | undefined =>
  isUuid(value) ? value : undefined

export const Route = createFileRoute('/settings/integrations')({
  component: IntegrationsSection,
  validateSearch: (search: Record<string, unknown>): IntegrationsSearch => {
    const key = idParam(search.key)
    const sample = key ? idParam(search.sample) : undefined
    return { ...(key ? { key } : {}), ...(sample ? { sample } : {}) }
  },
})
