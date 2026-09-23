import { Gauge, MoreVertical, Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import type { LocalIntegrationKey } from '#/db/types'
import {
  describeKey,
  ruleCountLabel,
} from '#/features/integrations/data/describe'
import { keyHealth } from '#/features/integrations/data/health'
import type { KeyHealth } from '#/features/integrations/data/health'
import { throttleNotice } from '#/features/integrations/data/throttle'
import { useDirectionStore } from '#/stores/direction'
import { usePreferencesStore } from '#/stores/preferences'

const DOT: Record<KeyHealth, string> = {
  active: 'bg-fp-accent',
  expiring: 'bg-fp-warn',
  expired: 'bg-fp-danger',
  revoked: 'border-[1.5px] border-fp-text-3 bg-transparent',
}

const ICON_BTN =
  'h-[34px] w-[34px] shrink-0 rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text'

type Props = {
  apiKey: LocalIntegrationKey
  walletName: string | null
  /** Every action here needs the server. */
  online: boolean
  onEdit: () => void
  onRotate: () => void
  onRevoke: () => void
  onDelete: () => void
}

export function KeyRow({
  apiKey,
  walletName,
  online,
  onEdit,
  onRotate,
  onRevoke,
  onDelete,
}: Props) {
  const locale = useDirectionStore((s) => s.locale)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const health = keyHealth(apiKey)
  const summary = describeKey(apiKey, { walletName, locale, dateFormat })
  const throttled = health === 'revoked' ? null : throttleNotice(apiKey, locale)

  return (
    <li className="flex items-center gap-3 border-b border-fp-border px-[18px] py-[13px] last:border-b-0">
      <span
        aria-hidden
        className={`h-[9px] w-[9px] shrink-0 rounded-full ${DOT[health]}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="min-w-0 truncate text-[14.5px] font-semibold">
            {apiKey.name}
          </span>
          <span
            dir="ltr"
            className="font-mono text-[12px] text-fp-text-3"
            title="The start of this key — the rest is secret"
          >
            {apiKey.tokenPrefix}…
          </span>
          <span className="text-[12px] text-fp-text-3">
            {ruleCountLabel(apiKey.ruleCount)}
          </span>
        </div>
        <div
          className={`mt-0.5 text-[12.5px] ${
            health === 'expired' ? 'text-fp-danger' : 'text-fp-text-2'
          }`}
        >
          {summary.join(' · ')}
        </div>
        {throttled ? (
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-fp-warn">
            <Gauge
              aria-hidden
              size={14}
              strokeWidth={2}
              className="mt-[2px] shrink-0"
            />
            <span className="min-w-0">{throttled}</span>
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onEdit}
        aria-label={`Edit ${apiKey.name}`}
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
            aria-label={`More actions for ${apiKey.name}`}
            className={ICON_BTN}
          >
            <MoreVertical size={16} strokeWidth={1.8} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[170px]">
          <DropdownMenuItem disabled={!online} onSelect={onRotate}>
            Rotate secret
          </DropdownMenuItem>
          {apiKey.status === 'active' ? (
            <DropdownMenuItem disabled={!online} onSelect={onRevoke}>
              Revoke
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!online}
            onSelect={onDelete}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
