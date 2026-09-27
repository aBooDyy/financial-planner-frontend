import { useState } from 'react'
import { SignOutConfirm } from '#/components/chrome/SignOutConfirm'
import { OfflineNotice } from '#/components/OfflineNotice'
import { Button } from '#/components/ui/button'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { exportCsv, exportJson } from '#/features/settings/data/exportData'
import { useOnline } from '#/hooks/useOnline'
import { usePreferencesStore } from '#/stores/preferences'
import { SectionHeader } from './SectionHeader'
import { SettingRow } from './SettingRow'
import { Toggle } from './Toggle'

const CARD = 'rounded-2xl border border-fp-border bg-fp-surface shadow-fp'
const GHOST =
  'rounded-[11px] border-fp-border-strong bg-fp-surface-2 px-[14px] py-[9px] text-[13px] font-semibold text-fp-text hover:border-fp-accent hover:bg-fp-surface-2'

export function DataSection() {
  const logout = useLogout()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)
  const online = useOnline()
  const autoBackup = usePreferencesStore((s) => s.autoBackup)
  const setAutoBackup = usePreferencesStore((s) => s.setAutoBackup)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Data & privacy"
        subtitle="Export, back up, or close your account."
      />

      <div className={`${CARD} p-[18px]`}>
        <div className="text-[15px] font-bold">Your data</div>
        <div className="mb-[13px] mt-[3px] text-[12.5px] text-fp-text-3">
          Download all wallets, transactions and budgets.
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            variant="outline"
            className={GHOST}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className={GHOST}
            onClick={() => void exportJson()}
          >
            Export JSON
          </Button>
        </div>
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <SettingRow
          label="Automatic backup"
          desc="Encrypted nightly backup to the cloud."
          last
        >
          <Toggle
            on={autoBackup}
            onChange={() => setAutoBackup(!autoBackup)}
            label="Automatic backup"
          />
        </SettingRow>
      </div>

      <div className="rounded-2xl border border-fp-danger/30 bg-fp-danger/5 p-[18px]">
        <div className="text-[15px] font-bold text-fp-danger">Danger zone</div>
        <div className="mb-3.5 mt-[3px] text-[12.5px] text-fp-text-2">
          These actions are permanent and cannot be undone.
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={!online}
            onClick={() => setConfirmingSignOut(true)}
            className="rounded-[11px] border-fp-border-strong bg-fp-surface px-[15px] py-2.5 text-[13px] font-semibold text-fp-text hover:border-fp-accent hover:bg-fp-surface"
          >
            Sign out
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled
            title="Account deletion isn’t available yet."
            className="cursor-not-allowed rounded-[11px] border border-fp-danger/50 bg-transparent px-[15px] py-2.5 text-[13px] font-bold text-fp-danger opacity-60 hover:bg-transparent hover:text-fp-danger"
          >
            Delete account
          </Button>
        </div>
        {online ? null : (
          <OfflineNotice className="mt-3">
            Signing out needs a connection, so changes you made offline can
            finish syncing first.
          </OfflineNotice>
        )}
      </div>
      <SignOutConfirm
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        onSignOut={() => void logout()}
      />
    </div>
  )
}
