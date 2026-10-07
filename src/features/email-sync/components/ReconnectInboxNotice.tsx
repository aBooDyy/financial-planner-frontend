import type { LocalEmailConnection } from '#/db/types'
import { useInboxReconnect } from '#/features/email-sync/hooks/useInboxReconnect'
import { useOnline } from '#/hooks/useOnline'
import { cn } from '#/lib/utils'
import { ReconnectButton } from './ReconnectButton'

type Props = {
  connection: LocalEmailConnection
  className?: string
}

/** One inbox that lost access, outside Settings: what happened and the way back in. */
export function ReconnectInboxNotice({ connection, className }: Props) {
  const online = useOnline()
  const { reconnect, busy, error } = useInboxReconnect(connection)

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[11px] border border-fp-warn-line bg-fp-warn-soft px-3 py-2.5 text-[12.5px] text-fp-text',
        className,
      )}
    >
      <span className="min-w-0">
        Means lost access to{' '}
        <bdi className="font-semibold">{connection.email}</bdi>. Sign in again
        to keep syncing it.
        {error ? (
          <span className="mt-1 block text-fp-danger">{error}</span>
        ) : null}
      </span>
      <ReconnectButton
        busy={busy}
        onReconnect={reconnect}
        disabled={!online}
        className="py-[7px]"
      />
    </div>
  )
}
