import { useState } from 'react'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { EmailProvider } from '#/features/email-sync/api/types'
import { beginInboxConnect } from '#/features/email-sync/data/connect'
import { PROVIDER_LABEL } from '#/features/email-sync/data/describe'
import { messageForApiError } from '#/lib/errorMessages'
import { cn } from '#/lib/utils'
import { EditorFooter } from './EditorFooter'

const PROVIDERS: {
  key: EmailProvider
  desc: string
  mark: string
  color: string
}[] = [
  {
    key: 'google',
    desc: 'Google Workspace or personal',
    mark: 'G',
    color: 'var(--fp-danger)',
  },
  {
    key: 'outlook',
    desc: 'Microsoft 365 or Hotmail',
    mark: 'O',
    color: 'var(--fp-transfer)',
  },
]

type Props = { open: boolean; onClose: () => void }

/** Pick the provider, then leave for its own sign-in page; the callback brings the user back. */
export function ConnectInboxDialog({ open, onClose }: Props) {
  const [provider, setProvider] = useState<EmailProvider | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    if (!provider) return
    setBusy(true)
    setError(null)
    try {
      await beginInboxConnect(provider)
    } catch (failure) {
      setError(messageForApiError(failure))
      setBusy(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Connect an inbox"
      description="Pick where your transaction alerts arrive. You’ll sign in on the provider’s own page."
      contentClassName="sm:max-w-[520px]"
      footer={
        <EditorFooter
          hint={
            <>
              <Lock size={13} strokeWidth={2} />
              Read-only access
            </>
          }
          error={error}
          onCancel={onClose}
          submitLabel={
            <>
              {busy ? 'Redirecting…' : 'Continue'}
              <ArrowRight
                size={16}
                strokeWidth={2.2}
                className="rtl:rotate-180"
              />
            </>
          }
          onSubmit={() => void connect()}
          disabled={!provider || busy}
        />
      }
    >
      <div
        role="radiogroup"
        aria-label="Inbox provider"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {PROVIDERS.map((p) => {
          const selected = provider === p.key
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setProvider(p.key)}
              className={cn(
                'relative rounded-[16px] border-[1.5px] p-4 text-start transition',
                selected
                  ? 'border-fp-accent bg-[color-mix(in_srgb,var(--fp-accent)_6%,var(--fp-surface))]'
                  : 'border-fp-border bg-fp-surface hover:border-fp-border-strong',
              )}
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-[12px] text-[17px] font-extrabold"
                style={{
                  color: p.color,
                  background: `color-mix(in srgb, ${p.color} 14%, var(--fp-surface))`,
                }}
              >
                {p.mark}
              </span>
              <span className="mt-[10px] block text-[15px] font-extrabold text-fp-text">
                {PROVIDER_LABEL[p.key]}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-fp-text-2">
                {p.desc}
              </span>
              {selected ? (
                <span
                  aria-hidden
                  className="absolute end-3 top-3 flex size-[22px] items-center justify-center rounded-full bg-fp-accent text-white"
                >
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </ResponsiveDialog>
  )
}
