import { CloudOff } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import type { LocalEmailConnection } from '#/db/types'
import type { ScanFrequency } from '#/features/email-sync/api/types'
import { lastSyncedLabel } from '#/features/email-sync/data/describe'
import { SkippedShapes } from '#/features/inbound-imports/components/SkippedShapes'
import type { InboxSettingsEditor } from '#/features/email-sync/hooks/useInboxSettings'
import { cn } from '#/lib/utils'
import { useDirectionStore } from '#/stores/direction'
import { ScanNowControl } from './ScanNowControl'

const FREQUENCIES: { value: ScanFrequency; label: string }[] = [
  { value: '15m', label: '15 min' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
]

type Props = {
  connection: LocalEmailConnection
  editor: InboxSettingsEditor
  online: boolean
}

/** How and when this inbox is read. Where each email goes is the rules' business. */
export function InboxSettingsForm({ connection, editor, online }: Props) {
  const locale = useDirectionStore((s) => s.locale)
  const { draft, set } = editor
  const synced = connection.lastSyncedAt !== null

  return (
    <div className="flex flex-col gap-[14px]">
      <section
        aria-labelledby="inbox-sync-heading"
        className="flex min-w-0 flex-col gap-3 rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface p-[14px]"
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'size-2 flex-none rounded-full',
              synced ? 'bg-fp-accent' : 'bg-fp-border-strong',
            )}
          />
          <h3 id="inbox-sync-heading" className="text-[14px] font-extrabold">
            {lastSyncedLabel(connection.lastSyncedAt, locale)}
          </h3>
        </div>
        <p className="text-[12.5px] leading-[1.5] text-fp-text-2">
          Sync now reads everything since the last sync, and keeps going until
          it has caught up.
        </p>
        {online ? (
          <ScanNowControl connectionId={connection.id} boxed />
        ) : (
          <NoteBox tone="neutral" icon={<CloudOff />}>
            Syncing needs a connection.
          </NoteBox>
        )}
      </section>

      <ToggleCard
        title="Sync when I open Means"
        description="Read new alerts each time the app starts."
        checked={draft.autoSync}
        onCheckedChange={(on) => set('autoSync', on)}
      />

      <div className="min-w-0">
        <FieldLabel>Background sync</FieldLabel>
        <PillSwitch
          label="Background sync"
          value={draft.scanFrequency}
          options={FREQUENCIES}
          onChange={(v) => set('scanFrequency', v)}
        />
        <FieldMessage help="How often Means will check on its own once background sync arrives." />
      </div>

      <SkippedShapes
        parent={{ connectionId: connection.id }}
        noun={{ one: 'email', many: 'emails' }}
        online={online}
      />
    </div>
  )
}
