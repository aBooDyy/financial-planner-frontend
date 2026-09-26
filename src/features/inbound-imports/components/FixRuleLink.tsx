import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import type { LocalInboundImport } from '#/db/types'

type Props = { item: LocalInboundImport }

const CLASS =
  'inline-flex items-center gap-[6px] self-start text-[12.5px] font-bold text-fp-accent-ink hover:underline'

/**
 * From a row its source could not read, into the rule editor that should have read it, with
 * this very body as the sample — the moment the user holds the proof the rule is wrong. The
 * queue names only the settings route of each source, never the source's code.
 */
export function FixRuleLink({ item }: Props) {
  if (item.source === 'webhook') {
    if (!item.keyId) return null
    return (
      <Link
        to="/settings/integrations"
        search={{ key: item.keyId, sample: item.id }}
        className={CLASS}
      >
        <Pencil size={13} strokeWidth={2.2} />
        Fix the rule
      </Link>
    )
  }
  if (!item.connectionId || !item.hasBody) return null
  return (
    <Link
      to="/settings/email-sync"
      search={{
        inbox: item.connectionId,
        sample: item.id,
        ...(item.ruleId ? { rule: item.ruleId } : {}),
      }}
      className={CLASS}
    >
      <Pencil size={13} strokeWidth={2.2} />
      Fix the rule
    </Link>
  )
}
