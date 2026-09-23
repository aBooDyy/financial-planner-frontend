import { useEffect, useRef } from 'react'
import { ArrowRight, Check, Lock, Mail } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { LocalEmailConnection } from '#/db/types'
import { useBalances } from '#/features/balances/hooks/useBalances'
import { walletGroupOptions } from '#/features/balances/data/selectors'
import {
  disconnectConnection,
  updateConnectionSettings,
} from '#/features/email-sync/data/mutations'
import type { ConnectionSettings } from '#/features/email-sync/data/mutations'
import { useEmailConnections } from '#/features/email-sync/hooks/useEmailConnections'
import { usePendingImports } from '#/features/inbound-imports/hooks/usePendingImports'
import { useEmailWizard } from '#/features/email-sync/hooks/useEmailWizard'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { ConnectedPanel } from './ConnectedPanel'
import { EmailSyncWizard } from './EmailSyncWizard'

const FEATURES = [
  {
    title: 'Read-only',
    desc: 'Means only reads messages — never sends, replies, or deletes.',
  },
  {
    title: 'You choose',
    desc: 'Pick exactly which senders count as transactions.',
  },
  {
    title: 'You confirm',
    desc: 'Point out the amount & currency once; we reuse the pattern.',
  },
]

function IdleCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex flex-wrap items-start gap-[18px] p-6">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[15px] bg-fp-accent-soft text-fp-accent-ink">
          <Mail size={26} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[18.5px] font-extrabold tracking-[-0.01em]">
            Auto-log transactions from your inbox
          </div>
          <div className="mt-1.5 max-w-[580px] text-[13.5px] leading-relaxed text-fp-text-2">
            Connect the inbox where your bank and card alerts land. Means reads
            those emails (read-only), finds the amount and currency, and books
            each transaction for you.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px border-y border-fp-border bg-fp-border sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-fp-surface px-[18px] py-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-fp-accent-soft text-fp-accent-ink">
                <Check size={13} strokeWidth={2.6} />
              </span>
              <span className="text-[13.5px] font-bold">{f.title}</span>
            </div>
            <div className="text-[12.5px] leading-relaxed text-fp-text-3">
              {f.desc}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 px-6 py-[18px]">
        <Button
          type="button"
          onClick={onStart}
          className="px-5 py-3 text-[14.5px]"
        >
          <ArrowRight size={17} strokeWidth={2} />
          Connect an inbox
        </Button>
        <span className="inline-flex items-center gap-[7px] text-[12.5px] text-fp-text-3">
          <Lock size={14} strokeWidth={1.8} />
          Read-only access · disconnect anytime
        </span>
      </div>
    </div>
  )
}

export function EmailSyncSection() {
  const { connections } = useEmailConnections()
  const { imports } = usePendingImports()
  const wizard = useEmailWizard()
  const { nodes } = useBalances()

  const walletGroups = walletGroupOptions(nodes)

  const connected = connections.filter((c) => c.status === 'connected')
  const pendingSetup = connections.find((c) => c.status === 'pending_setup')

  // Returning from the OAuth redirect leaves a PENDING_SETUP connection; resume its setup.
  const resumeSetup = wizard.actions.resumeSetup
  const wizardIdle = wizard.state.step === 'idle'
  // Resume fetches the inbox's messages, so it must happen once per connection, not once
  // per render: `pendingSetup` is a row from a live query and arrives as a new object every
  // time the table emits, which a plain dependency on it would read as a new connection.
  const resumedId = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingSetup || !wizardIdle) return
    if (resumedId.current === pendingSetup.id) return
    resumedId.current = pendingSetup.id
    void resumeSetup(pendingSetup)
  }, [pendingSetup, wizardIdle, resumeSetup])

  const saveSettings =
    (connection: LocalEmailConnection) => (s: ConnectionSettings) => {
      void updateConnectionSettings(connection, s)
    }

  const body = () => {
    if (wizard.state.step !== 'idle') {
      return <EmailSyncWizard wizard={wizard} />
    }
    if (connected.length > 0) {
      return (
        <div className="flex flex-col gap-5">
          {connected.map((c) => (
            <ConnectedPanel
              key={c.id}
              connection={c}
              walletGroups={walletGroups}
              recent={imports.filter((i) => i.connectionId === c.id)}
              onSave={saveSettings(c)}
              onDisconnect={() => void disconnectConnection(c.id)}
              onConnectAnother={wizard.actions.start}
            />
          ))}
        </div>
      )
    }
    return <IdleCard onStart={wizard.actions.start} />
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Email sync"
        subtitle="Connect an inbox so Means auto-logs your bank and card transactions."
      />
      {body()}
    </div>
  )
}
