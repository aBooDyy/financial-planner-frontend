import { Check, Info, Plus } from 'lucide-react'
import type { LocalEmailConnection, LocalInboundImport } from '#/db/types'
import type { ConnectionSettings } from '#/features/email-sync/data/mutations'
import type { ScanFrequency } from '#/features/email-sync/api/types'
import { Toggle } from '#/features/settings/components/Toggle'
import { Segmented } from '#/features/settings/components/Segmented'
import { SettingRow } from '#/features/settings/components/SettingRow'
import type { WalletGroupOption } from '#/features/balances/data/selectors'
import { formatMoney } from '#/lib/currency'
import { Alert, AlertDescription } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { ScanNowControl } from './ScanNowControl'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Gmail',
  outlook: 'Outlook',
}
const FREQS: { value: ScanFrequency; label: string }[] = [
  { value: '15m', label: '15 min' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
]

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '@'
}

type Props = {
  connection: LocalEmailConnection
  walletGroups: WalletGroupOption[]
  recent: LocalInboundImport[]
  onSave: (settings: ConnectionSettings) => void
  onDisconnect: () => void
  onConnectAnother: () => void
}

export function ConnectedPanel({
  connection,
  walletGroups,
  recent,
  onSave,
  onDisconnect,
  onConnectAnother,
}: Props) {
  const settings: ConnectionSettings = {
    autoSync: connection.autoSync,
    autoConfirm: connection.autoConfirm,
    scanFrequency: connection.scanFrequency,
    defaultWalletId: connection.defaultWalletId,
  }
  const save = (patch: Partial<ConnectionSettings>) =>
    onSave({ ...settings, ...patch })

  return (
    <div className="flex flex-col gap-[14px]">
      {/* Connected banner */}
      <div className="flex flex-wrap items-center gap-[14px] rounded-2xl border border-fp-accent bg-fp-accent-soft px-[18px] py-4">
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-fp-accent text-white">
          <Check size={22} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-extrabold text-fp-accent-ink">
            Inbox connected
          </div>
          <div className="mt-0.5 truncate text-[13px] text-fp-text-2">
            {PROVIDER_LABEL[connection.provider] ?? connection.provider} ·{' '}
            {connection.email} · syncing {connection.rules.length} alert
            {connection.rules.length === 1 ? '' : ' types'}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onDisconnect}
          className="shrink-0 bg-fp-surface px-[14px] py-[9px] text-[13px] font-semibold"
        >
          Disconnect
        </Button>
      </div>

      {/* Manual scan */}
      <div className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-[18px] py-[15px]">
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold">
              Scan this inbox now
            </div>
            <div className="mt-0.5 text-[12.5px] text-fp-text-3">
              Look for alerts that haven’t been imported yet.
            </div>
          </div>
          <ScanNowControl connectionId={connection.id} />
        </div>
      </div>

      {/* Sync settings */}
      <div className={CARD}>
        <SettingRow
          label="Auto-sync transactions"
          desc="Log new alerts automatically as they arrive."
        >
          <Toggle
            on={connection.autoSync}
            onChange={() => save({ autoSync: !connection.autoSync })}
            label="Auto-sync"
          />
        </SettingRow>
        <SettingRow
          label="Auto-confirm new transactions"
          desc={
            connection.autoConfirm
              ? 'Posts each alert straight into your transactions.'
              : 'Holds new alerts in a pending list to review and categorize first.'
          }
        >
          <Toggle
            on={connection.autoConfirm}
            onChange={() => save({ autoConfirm: !connection.autoConfirm })}
            label="Auto-confirm"
          />
        </SettingRow>
        {!connection.autoConfirm ? (
          <Alert className="items-start gap-[9px] rounded-none border-x-0 border-t-0 border-b border-fp-border bg-fp-accent-soft px-[18px] py-[11px]">
            <Info
              size={15}
              strokeWidth={1.8}
              className="mt-px shrink-0 text-fp-accent-ink"
            />
            <AlertDescription className="text-[12px] font-semibold leading-relaxed text-fp-accent-ink">
              New alerts wait in <b>Spending → Review</b> until you confirm
              them.
            </AlertDescription>
          </Alert>
        ) : null}
        <SettingRow
          label="Post auto-confirmed to"
          desc="Which account auto-confirmed alerts hit."
        >
          <Select
            value={connection.defaultWalletId ?? '__none__'}
            onValueChange={(v) =>
              save({ defaultWalletId: v === '__none__' ? null : v })
            }
          >
            <SelectTrigger className="w-auto px-3 py-2 text-[13px]">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose…</SelectItem>
              {walletGroups.map((g, i) =>
                g.label === null ? (
                  g.wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectGroup key={`${g.label}-${i}`}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ),
              )}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Check inbox every"
          desc="How often Means scans for new alerts."
          last
        >
          <Segmented
            value={connection.scanFrequency}
            options={FREQS}
            onChange={(v) => save({ scanFrequency: v })}
          />
        </SettingRow>
      </div>

      {/* Tracked alert types */}
      <div className={CARD}>
        <div className="flex items-center gap-[10px] border-b border-fp-border px-[18px] py-[14px]">
          <span className="text-[14.5px] font-bold">Tracked alert types</span>
          <Badge
            variant="outline"
            className="border-fp-border bg-fp-surface-2 px-[9px] py-0.5 text-[12px] font-normal text-fp-text-3"
          >
            {connection.rules.length}
          </Badge>
        </div>
        {connection.rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 border-b border-fp-border px-[18px] py-[13px] last:border-b-0"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-fp-accent-soft text-[12px] font-bold text-fp-accent-ink">
              {initials(r.senderName ?? r.senderEmail)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold">
                {r.senderName ?? r.senderEmail}
              </div>
              <div className="truncate text-[12px] text-fp-text-3">
                {r.senderEmail}
              </div>
            </div>
            <Badge className="shrink-0 gap-1.5 bg-fp-accent-soft px-[10px] py-[5px] text-[12px] font-semibold text-fp-accent-ink">
              <Check size={12} strokeWidth={2.4} />
              Amount + currency
            </Badge>
          </div>
        ))}
      </div>

      {/* Recently auto-logged */}
      {recent.length > 0 ? (
        <div className={CARD}>
          <div className="flex items-center gap-2 border-b border-fp-border px-[18px] py-[14px]">
            <span className="h-[7px] w-[7px] rounded-full bg-fp-accent" />
            <span className="text-[14.5px] font-bold">
              Pending from these alerts
            </span>
          </div>
          {recent.slice(0, 4).map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 border-b border-fp-border px-[18px] py-[13px] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">
                  {r.suggestedMerchant ?? r.sourceLabel ?? r.sourceRef}
                </div>
                <div className="text-[12px] text-fp-text-3">
                  {r.occurredOn ?? ''}
                </div>
              </div>
              <div className="shrink-0 text-[14px] font-extrabold tabular-nums">
                {r.amount != null && r.currency
                  ? `− ${formatMoney(r.amount, r.currency)}`
                  : '—'}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={onConnectAnother}
          className="gap-[7px] bg-fp-surface px-4 py-[11px] text-[13.5px] font-semibold hover:border-fp-accent"
        >
          <Plus size={15} strokeWidth={2.2} />
          Connect another inbox
        </Button>
      </div>
    </div>
  )
}
