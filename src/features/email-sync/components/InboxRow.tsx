import { useState } from 'react'
import { Loader2, MoreVertical, Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type { LocalEmailConnection } from '#/db/types'
import { describeInbox, inboxHealth } from '#/features/email-sync/data/describe'
import type { InboxHealth } from '#/features/email-sync/data/describe'
import { windowLabel, windowOptions } from '#/features/email-sync/data/windows'
import type { ScanOptions } from '#/features/email-sync/api/types'
import { useInboxReconnect } from '#/features/email-sync/hooks/useInboxReconnect'
import { useManualScan } from '#/features/email-sync/hooks/useManualScan'
import { useScanToast } from '#/features/email-sync/hooks/useScanToast'
import { useConfigLimits } from '#/lib/config/appConfig'
import { useDirectionStore } from '#/stores/direction'
import { CustomWindowDialog } from './CustomWindowDialog'
import { ReconnectButton } from './ReconnectButton'
import { ScanToast } from './ScanToast'
import { SyncNowButton } from './SyncNowButton'

const DOT: Record<InboxHealth, string> = {
  signin: 'bg-fp-warn',
  reading: 'bg-fp-accent',
  idle: 'border-[1.5px] border-fp-text-3 bg-transparent',
  empty: 'bg-fp-warn',
}

const ICON_BTN =
  'h-[34px] w-[34px] shrink-0 rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text'

type Props = {
  connection: LocalEmailConnection
  /** Every action here needs the server. */
  online: boolean
  onEdit: () => void
  onAddRule: () => void
  onDisconnect: () => void
}

/** One connected inbox: what it is, how it reads, and a sync from where it last stopped. */
export function InboxRow({
  connection,
  online,
  onEdit,
  onAddRule,
  onDisconnect,
}: Props) {
  const locale = useDirectionStore((s) => s.locale)
  const maxLookbackDays = useConfigLimits().emailSyncMaxLookbackDays
  const { state, summary, scan } = useManualScan()
  const health = inboxHealth(connection)
  const signIn = useInboxReconnect(connection)
  const unreadable = health === 'signin'
  const toast = useScanToast(state, summary)
  const running = state.status === 'scanning' || state.status === 'busy'
  const [request, setRequest] = useState<ScanOptions>({})
  const run = (options: ScanOptions) => {
    if (running) return
    setRequest(options)
    void scan(options)
  }
  const sync = () => run({ connectionId: connection.id })
  const backfill = (days: number) =>
    run({ connectionId: connection.id, lookbackDays: days })
  const [customOpen, setCustomOpen] = useState(false)

  return (
    <li className="flex flex-col gap-2 border-b border-fp-border px-[18px] py-[13px] last:border-b-0">
      <div className="flex items-center gap-3">
        {running ? (
          <Loader2
            aria-hidden
            size={13}
            strokeWidth={2.4}
            className="-mx-0.5 shrink-0 animate-spin text-fp-accent"
          />
        ) : (
          <span
            aria-hidden
            className={`h-[9px] w-[9px] shrink-0 rounded-full ${DOT[health]}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">
            <bdi>{connection.email}</bdi>
          </div>
          <div className="mt-0.5 text-[12.5px] text-fp-text-2">
            {describeInbox(connection, locale).join(' · ')}
          </div>
        </div>
        {unreadable ? (
          <ReconnectButton
            busy={signIn.busy}
            onReconnect={signIn.reconnect}
            disabled={!online}
            className="hidden sm:inline-flex"
          />
        ) : health === 'empty' ? (
          <Button
            type="button"
            variant="outline"
            disabled={!online}
            onClick={onAddRule}
            className="hidden shrink-0 bg-fp-surface px-[14px] py-[9px] text-[13px] font-semibold sm:inline-flex"
          >
            Add a rule
          </Button>
        ) : (
          <SyncNowButton
            state={state}
            onSync={sync}
            disabled={!online}
            variant="outline"
            className="hidden sm:inline-flex"
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label={`Edit ${connection.email}`}
          className={ICON_BTN}
        >
          <Pencil size={15} strokeWidth={1.8} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`More actions for ${connection.email}`}
              className={ICON_BTN}
            >
              <MoreVertical size={16} strokeWidth={1.8} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[190px]">
            {unreadable ? (
              <DropdownMenuItem
                disabled={!online || signIn.busy}
                onSelect={signIn.reconnect}
              >
                Reconnect
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              disabled={!online || running || unreadable}
              onSelect={sync}
            >
              Sync now
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                disabled={!online || running || unreadable}
              >
                Sync older emails
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {windowOptions(maxLookbackDays).map((days) => (
                  <DropdownMenuItem key={days} onSelect={() => backfill(days)}>
                    {windowLabel(days)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setCustomOpen(true)}>
                  From a date…
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem disabled={!online} onSelect={onAddRule}>
              Add a rule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={!online}
              onSelect={onDisconnect}
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {unreadable ? (
        <p role="status" className="ps-[21px] text-[12.5px] text-fp-warn">
          Means lost access to this inbox, so nothing new is read from it.
          Reconnect to sign in again — its rules are kept.
          {signIn.error ? (
            <span className="mt-0.5 block text-fp-danger">{signIn.error}</span>
          ) : null}
        </p>
      ) : health === 'empty' ? (
        <p className="ps-[21px] text-[12.5px] text-fp-warn">
          Nothing is read from this inbox until it has a rule.
        </p>
      ) : null}
      <ScanToast
        open={toast.open}
        state={state}
        summary={summary}
        inbox={connection.email}
        lookbackDays={request.lookbackDays}
        onRetry={() => run(request)}
        onDismiss={toast.dismiss}
      />
      {customOpen ? (
        <CustomWindowDialog
          onClose={() => setCustomOpen(false)}
          onPick={backfill}
        />
      ) : null}
    </li>
  )
}
