import { MoreVertical, Pencil } from 'lucide-react'
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
import { useManualScan } from '#/features/email-sync/hooks/useManualScan'
import { useConfigLimits } from '#/lib/config/appConfig'
import { useDirectionStore } from '#/stores/direction'
import { ScanResultLine } from './ScanResultLine'
import { SyncNowButton } from './SyncNowButton'

const DOT: Record<InboxHealth, string> = {
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
  const running = state.status === 'scanning' || state.status === 'busy'
  const sync = () => void scan({ connectionId: connection.id })

  return (
    <li className="flex flex-col gap-2 border-b border-fp-border px-[18px] py-[13px] last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`h-[9px] w-[9px] shrink-0 rounded-full ${DOT[health]}`}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold">
            <bdi>{connection.email}</bdi>
          </div>
          <div className="mt-0.5 text-[12.5px] text-fp-text-2">
            {describeInbox(connection, locale).join(' · ')}
          </div>
        </div>
        {health === 'empty' ? (
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
            <DropdownMenuItem disabled={!online || running} onSelect={sync}>
              Sync now
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={!online || running}>
                Sync older emails
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {windowOptions(maxLookbackDays).map((days) => (
                  <DropdownMenuItem
                    key={days}
                    onSelect={() =>
                      void scan({
                        connectionId: connection.id,
                        lookbackDays: days,
                      })
                    }
                  >
                    {windowLabel(days)}
                  </DropdownMenuItem>
                ))}
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
      {health === 'empty' ? (
        <p className="ps-[21px] text-[12.5px] text-fp-warn">
          Nothing is read from this inbox until it has a rule.
        </p>
      ) : null}
      <div className="ps-[21px]">
        <ScanResultLine state={state} summary={summary} onRetry={sync} />
      </div>
    </li>
  )
}
