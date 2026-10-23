import { useInboxesToReconnect } from '#/features/email-sync/hooks/useInboxesToReconnect'
import { ReconnectInboxNotice } from './ReconnectInboxNotice'

/** Inside the review queue: every inbox that has stopped feeding it, with a way to sign in again. */
export function ReviewReconnectNotices({ className }: { className?: string }) {
  const toReconnect = useInboxesToReconnect()
  if (toReconnect.length === 0) return null
  return (
    <div className={className}>
      {toReconnect.map((c) => (
        <ReconnectInboxNotice key={c.id} connection={c} className="w-full" />
      ))}
    </div>
  )
}
