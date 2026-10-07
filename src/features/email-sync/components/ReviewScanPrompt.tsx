import { useInboxesToReconnect } from '#/features/email-sync/hooks/useInboxesToReconnect'
import { ReconnectInboxNotice } from './ReconnectInboxNotice'
import { ScanNowControl } from './ScanNowControl'

/**
 * The inbox's offer inside the review queue: sync for more without leaving it, and sign in
 * again any inbox that has stopped feeding it.
 */
export function ReviewScanPrompt() {
  const toReconnect = useInboxesToReconnect()
  return (
    <>
      {toReconnect.map((c) => (
        <ReconnectInboxNotice key={c.id} connection={c} className="w-full" />
      ))}
      <span className="text-[12.5px] text-fp-text-3">
        Expecting more? Sync your inboxes without leaving.
      </span>
      <ScanNowControl compact />
    </>
  )
}
