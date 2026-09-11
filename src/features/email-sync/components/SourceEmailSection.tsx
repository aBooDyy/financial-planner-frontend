import { useState } from 'react'
import { ChevronDown, Mail } from 'lucide-react'
import { useImportDetail } from '#/features/email-sync/hooks/useImportDetail'
import { EmailBodyPreview } from './EmailBodyPreview'

/** True for ledger entries promoted from an inbox alert (`source = "email:<connection>"`). */
export const isEmailSourced = (source: string | null | undefined): boolean =>
  !!source?.startsWith('email:')

/**
 * The email a ledger entry was auto-logged from, on demand. Entered manually? Nothing renders
 * — the caller gates on {@link isEmailSourced}.
 */
export function SourceEmailSection({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false)
  const detail = useImportDetail(
    { kind: 'transaction', id: transactionId },
    open,
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-[7px] text-[12.5px] font-semibold text-fp-text-2"
      >
        <Mail size={14} strokeWidth={2} />
        {open ? 'Hide source email' : 'View source email'}
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          className={open ? 'rotate-180' : ''}
        />
      </button>
      {open ? (
        <div className="mt-[8px]">
          <EmailBodyPreview
            lines={detail.detail?.bodyLines ?? []}
            truncated={detail.detail?.bodyTruncated ?? false}
            loading={detail.loading}
            error={detail.error}
          />
        </div>
      ) : null}
    </div>
  )
}
