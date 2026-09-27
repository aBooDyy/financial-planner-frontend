import { useNavigate } from '@tanstack/react-router'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { Button } from '#/components/ui/button'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { useCsvImport } from '#/features/import/hooks/useCsvImport'
import { useSessionStore } from '#/stores/session'
import { CsvImportWizard } from './CsvImportWizard'

/** The file wizard, full width so the review grid has room. Settings › Import is its way in. */
export function ImportPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  const csv = useCsvImport()

  if (!user) return null

  const leave = () => {
    csv.actions.reset()
    void navigate({ to: '/settings/import' })
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav user={user} onSignOut={() => void logout()} />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-[14px] py-4 pb-[30px] md:gap-6 md:px-6 md:py-[26px] md:pb-[90px]">
          <SectionHeader
            title="Import a file"
            subtitle="Your file is read on this device and never uploaded."
            action={
              // Once the commit has started there is nothing to cancel — undo covers regret.
              csv.step !== 'committing' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-[14px] py-[9px] text-[13px]"
                  onClick={leave}
                >
                  {csv.step === 'done' ? 'Back to Import' : 'Cancel import'}
                </Button>
              ) : undefined
            }
          />

          <CsvImportWizard csv={csv} />
        </div>
      </div>

      <MobileTabBar />
    </div>
  )
}
