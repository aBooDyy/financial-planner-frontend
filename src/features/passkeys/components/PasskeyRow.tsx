import {
  KeyRound,
  Monitor,
  Pencil,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TagPill } from '#/components/TagPill'
import { Button } from '#/components/ui/button'
import type { Passkey, PasskeyDeviceType } from '#/features/passkeys/api/types'
import {
  addedLine,
  deviceLine,
  lastUsedLine,
} from '#/features/passkeys/data/describe'
import { useDirectionStore } from '#/stores/direction'
import { usePreferencesStore } from '#/stores/preferences'

const DEVICE_ICON: Record<PasskeyDeviceType, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  other: KeyRound,
}

const ICON_BTN =
  'h-[34px] w-[34px] shrink-0 rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2 hover:text-fp-text'

type Props = {
  passkey: Passkey
  /** Renaming and removing both need the server. */
  online: boolean
  onRename: () => void
  onRemove: () => void
}

/** One passkey: what it's called, where it was made, and when it was last used. */
export function PasskeyRow({ passkey, online, onRename, onRemove }: Props) {
  const locale = useDirectionStore((s) => s.locale)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const Icon = passkey.deviceType ? DEVICE_ICON[passkey.deviceType] : KeyRound
  const made = [passkey.providerName, deviceLine(passkey)].filter(Boolean)

  return (
    <li className="flex items-center gap-3 border-b border-fp-border px-[18px] py-[13px] last:border-b-0">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-fp-accent-soft text-fp-accent-ink"
      >
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold">
            <bdi>{passkey.name}</bdi>
          </span>
          {passkey.backedUp ? <TagPill label="Synced" tone="accent" /> : null}
        </div>
        {made.length > 0 ? (
          <div className="mt-0.5 truncate text-[12.5px] text-fp-text-2">
            {made.join(' · ')}
          </div>
        ) : null}
        <div className="mt-0.5 text-[12px] text-fp-text-3">
          {addedLine(passkey, dateFormat)} · {lastUsedLine(passkey, locale)}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!online}
        onClick={onRename}
        aria-label={`Rename ${passkey.name}`}
        className={ICON_BTN}
      >
        <Pencil size={15} strokeWidth={1.8} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!online}
        onClick={onRemove}
        aria-label={`Remove ${passkey.name}`}
        className={ICON_BTN}
      >
        <Trash2 size={15} strokeWidth={1.8} />
      </Button>
    </li>
  )
}
