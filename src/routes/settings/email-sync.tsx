import { createFileRoute } from '@tanstack/react-router'
import { EmailSyncSection } from '#/features/email-sync/components/EmailSyncSection'
import { isUuid } from '#/lib/uuid'

export type EmailSyncSearch = {
  /** `?inbox=<id>` — open that inbox's editor. */
  inbox?: string
  /** With `inbox`: open straight onto a new rule (right after connecting). */
  fresh?: boolean
  /** With `inbox` and `sample`: the rule to open on the sample. */
  rule?: string
  /** With `inbox`: a staged import whose email becomes the rule's sample ("Fix the rule"). */
  sample?: string
}

const idParam = (value: unknown): string | undefined =>
  isUuid(value) ? value : undefined

export const Route = createFileRoute('/settings/email-sync')({
  component: EmailSyncSection,
  validateSearch: (search: Record<string, unknown>): EmailSyncSearch => {
    const inbox = idParam(search.inbox)
    if (!inbox) return {}
    const sample = idParam(search.sample)
    const rule = sample ? idParam(search.rule) : undefined
    const fresh =
      search.fresh === true || search.fresh === '1' || search.fresh === 1
    return {
      inbox,
      ...(fresh && !sample ? { fresh: true } : {}),
      ...(sample ? { sample } : {}),
      ...(rule ? { rule } : {}),
    }
  },
})
