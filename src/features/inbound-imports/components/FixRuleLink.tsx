import { Link } from '@tanstack/react-router'
import { Wrench } from 'lucide-react'

type Props = { keyId: string; importId: string }

/**
 * From a webhook row the rules could not read, into that key's rule editor with this very
 * payload as the sample — the moment the user holds the payload that proves the rule wrong.
 */
export function FixRuleLink({ keyId, importId }: Props) {
  return (
    <Link
      to="/settings/integrations"
      search={{ key: keyId, sample: importId }}
      className="inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-fp-accent-ink hover:underline"
    >
      <Wrench size={13} strokeWidth={2.2} />
      Fix the rule
    </Link>
  )
}
