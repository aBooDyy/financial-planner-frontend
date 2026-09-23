import { Mail, Zap } from 'lucide-react'
import type { InboundSource } from '#/features/inbound-imports/api/types'

const LABEL: Record<InboundSource, string> = {
  inbox: 'From an email',
  webhook: 'From a webhook',
}

/** The 14px mark before a staged row's source label: an envelope or a bolt. */
export function SourceChip({ source }: { source: InboundSource }) {
  const Glyph = source === 'webhook' ? Zap : Mail
  return (
    <Glyph
      size={14}
      strokeWidth={2}
      role="img"
      aria-label={LABEL[source]}
      className="shrink-0 text-fp-text-3"
    />
  )
}
