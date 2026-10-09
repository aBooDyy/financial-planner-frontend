import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Braces, ChevronDown, Mail } from 'lucide-react'
import type { LedgerSource } from '#/features/inbound-imports/data/sources'
import { useImportDetail } from '#/features/inbound-imports/hooks/useImportDetail'
import { BodyPreview } from './BodyPreview'

type Props = {
  transactionId: string
  /** Where the entry came from — the caller renders nothing for an entry not from an import. */
  origin: LedgerSource
}

const TOGGLE: Record<LedgerSource['kind'], string> = {
  email: 'source email',
  webhook: 'source payload',
}

function AddedBy({
  label,
  keyId,
}: {
  label: string | null
  keyId: string | null
}) {
  return (
    <div className="mb-[8px] flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[12.5px]">
      <span className="min-w-0 truncate text-fp-text-2">
        Added by{' '}
        <span className="font-semibold text-fp-text">
          {label ?? 'a webhook'}
        </span>
      </span>
      {keyId ? (
        <Link
          to="/settings/integrations"
          search={{ key: keyId }}
          className="shrink-0 font-semibold text-fp-accent-ink hover:underline"
        >
          View key
        </Link>
      ) : null}
    </div>
  )
}

/** What a ledger entry was auto-logged from — the email or the webhook payload — on demand. */
export function SourceSection({ transactionId, origin }: Props) {
  const [open, setOpen] = useState(false)
  const detail = useImportDetail(
    { kind: 'transaction', id: transactionId },
    open,
  )
  const Glyph = origin.kind === 'webhook' ? Braces : Mail
  const loaded = detail.detail

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-[7px] text-[12.5px] font-semibold text-fp-text-2"
      >
        <Glyph size={14} strokeWidth={2} />
        {open ? 'Hide' : 'View'} {TOGGLE[origin.kind]}
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          className={open ? 'rotate-180' : ''}
        />
      </button>
      {open ? (
        <div className="mt-[8px]">
          {origin.kind === 'webhook' && loaded ? (
            <AddedBy label={loaded.import.sourceLabel} keyId={origin.keyId} />
          ) : null}
          <BodyPreview
            source={origin.kind === 'webhook' ? 'webhook' : 'inbox'}
            format={
              loaded?.import.bodyFormat ??
              (origin.kind === 'webhook' ? 'json' : 'text')
            }
            lines={loaded?.bodyLines ?? []}
            truncated={loaded?.bodyTruncated ?? false}
            loading={detail.loading}
            error={detail.error}
          />
        </div>
      ) : null}
    </div>
  )
}
