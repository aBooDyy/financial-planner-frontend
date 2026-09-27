import { OfflineNotice } from '#/components/OfflineNotice'
import type { EmailProvider } from '#/features/email-sync/api/types'
import { useOnline } from '#/hooks/useOnline'
import { useInboxConnect } from '../hooks/useInboxConnect'
import { ConnectedInbox } from './ConnectedInbox'
import { PrivacyPromises } from './PrivacyPromises'
import { ProviderButton } from './ProviderButton'
import { StepIntro } from './StepIntro'

const PROVIDERS: {
  id: EmailProvider
  label: string
  color: string
  note?: string
}[] = [
  {
    id: 'google',
    label: 'Connect Gmail',
    color: '#EA4335',
    note: 'Most popular',
  },
  { id: 'outlook', label: 'Connect Outlook', color: '#0A64D8' },
]

export function EmailStep() {
  const { inbox, connecting, error, connect, undo } = useInboxConnect()
  const online = useOnline()

  return (
    <>
      <StepIntro
        eyebrow="Optional"
        title="Want Means to fill in your transactions?"
      >
        Connect your email and we'll pick up receipts and bank alerts, so you
        don't have to type in every purchase.
      </StepIntro>

      <div className="mt-[26px] flex max-w-[420px] flex-col gap-2.5">
        {inbox ? (
          <ConnectedInbox
            email={inbox.email}
            canUndo={online}
            onUndo={() => void undo(inbox.id)}
          />
        ) : (
          PROVIDERS.map((p) => (
            <ProviderButton
              key={p.id}
              label={p.label}
              color={p.color}
              note={p.note}
              busy={connecting === p.id}
              disabled={connecting !== null || !online}
              onClick={() => void connect(p.id)}
            />
          ))
        )}
        {online || inbox ? null : (
          <OfflineNotice>
            Connecting an inbox needs a connection. You can also do it later in
            Settings.
          </OfflineNotice>
        )}
        {error && (
          <p role="alert" className="text-[13.5px] text-fp-danger">
            {error}
          </p>
        )}
      </div>

      <PrivacyPromises />
    </>
  )
}
