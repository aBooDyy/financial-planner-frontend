import { useState } from 'react'
import { FileUp } from 'lucide-react'
import { MobileTabBar } from '#/components/chrome/MobileTabBar'
import { TopNav } from '#/components/chrome/TopNav'
import { Button } from '#/components/ui/button'
import { useLogout } from '#/features/auth/hooks/useLogout'
import { setBaseCurrency } from '#/features/balances/data/mutations'
import { useBalances } from '#/features/balances/hooks/useBalances'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { useCsvImport } from '#/features/import/hooks/useCsvImport'
import { useSessionStore } from '#/stores/session'
import type { CurrencyCode } from '#/lib/currency'
import { CsvImportWizard } from './CsvImportWizard'
import { ImportHistoryCard } from './ImportHistoryCard'
import { ImportSourceCard } from './ImportSourceCard'
import { InboxSourceCard } from './InboxSourceCard'

export function ImportPage() {
  const user = useSessionStore((s) => s.user)
  const logout = useLogout()
  const { base } = useBalances()
  const csv = useCsvImport()
  const [importing, setImporting] = useState(false)

  if (!user) return null

  const leave = () => {
    csv.actions.reset()
    setImporting(false)
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-fp-bg text-fp-text">
      <TopNav
        user={user}
        base={base}
        onBaseChange={(code: CurrencyCode) => void setBaseCurrency(code)}
        onSignOut={() => void logout()}
      />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-[14px] py-4 pb-[30px] md:gap-6 md:px-6 md:py-[26px] md:pb-[90px]">
          <SectionHeader
            title={importing ? 'Import a file' : 'Import'}
            subtitle={
              importing
                ? 'Your file is read on this device and never uploaded.'
                : 'Bring transactions in from your inbox or from a file.'
            }
            action={
              // Once the commit has started there is nothing to cancel — undo covers regret.
              importing && csv.step !== 'committing' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-[14px] py-[9px] text-[13px]"
                  onClick={leave}
                >
                  Cancel import
                </Button>
              ) : undefined
            }
          />

          {importing ? (
            <CsvImportWizard csv={csv} />
          ) : (
            <>
              <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
                <InboxSourceCard />

                <ImportSourceCard
                  icon={FileUp}
                  title="From a file"
                  footer={
                    <Button
                      type="button"
                      className="px-[15px] py-[10px] text-[13.5px]"
                      onClick={() => setImporting(true)}
                    >
                      Choose a file
                    </Button>
                  }
                >
                  <span>
                    Upload a CSV exported from your bank or another app.
                  </span>
                  <span>
                    Nothing is uploaded — the file is read on this device.
                  </span>
                </ImportSourceCard>
              </div>

              <ImportHistoryCard />
            </>
          )}
        </div>
      </div>

      <MobileTabBar />
    </div>
  )
}
