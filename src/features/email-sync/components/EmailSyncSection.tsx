import { useMemo } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { CloudOff, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { walletGroupOptions } from '#/features/wallets/data/selectors'
import { useWallets } from '#/features/wallets/hooks/useWallets'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { useEmailConnections } from '#/features/email-sync/hooks/useEmailConnections'
import { useInboxFlow } from '#/features/email-sync/hooks/useInboxFlow'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { ConnectInboxDialog } from './ConnectInboxDialog'
import { DisconnectInboxDialog } from './DisconnectInboxDialog'
import { InboxEditorDialog } from './InboxEditorDialog'
import { InboxList } from './InboxList'
import { NoInboxCard } from './NoInboxCard'

/** Read through the route API rather than the route module, which imports this component. */
const settingsRoute = getRouteApi('/settings/email-sync')

export function EmailSyncSection() {
  const model = useEmailConnections()
  const search = settingsRoute.useSearch()
  const navigate = useNavigate()
  const flow = useInboxFlow(search)
  const { nodes, base } = useWallets()
  const catalog = useCategoryCatalog()
  const walletGroups = useMemo(() => walletGroupOptions(nodes), [nodes])

  const closeEditor = () => {
    flow.closeEditor()
    if (search.inbox) {
      void navigate({ to: '/settings/email-sync', search: {}, replace: true })
    }
  }
  const editing = model.connections.find((c) => c.id === flow.editingId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Email sync"
        subtitle="Log transactions from the bank and card alerts in your inbox."
      />

      {!model.online ? (
        <p
          role="status"
          className="flex items-center gap-2 text-[12.5px] text-fp-text-2"
        >
          <CloudOff size={15} strokeWidth={1.8} className="shrink-0" />
          You’re offline. These are your inboxes as of the last sync — syncing
          or changing one needs the server.
        </p>
      ) : model.stale ? (
        <p role="status" className="text-[12.5px] text-fp-text-2">
          Couldn’t refresh your inboxes. Showing the last copy on this device.
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-extrabold">Inboxes</h2>
        {model.connections.length > 0 ? (
          <Button
            type="button"
            disabled={!model.online}
            onClick={flow.startConnect}
            className="gap-1.5 px-4 py-[9px] text-[13.5px]"
          >
            <Plus size={15} strokeWidth={2.2} />
            Connect inbox
          </Button>
        ) : null}
      </div>

      {model.loading ? null : model.connections.length === 0 ? (
        <NoInboxCard canConnect={model.online} onConnect={flow.startConnect} />
      ) : (
        <InboxList
          connections={model.connections}
          online={model.online}
          onEdit={flow.edit}
          onAddRule={flow.addRule}
          onDisconnect={flow.askDisconnect}
        />
      )}

      {model.connections.length > 0 ? (
        <p className="text-[12.5px] leading-relaxed text-fp-text-3">
          Means syncs each inbox when you open the app. Background sync is on
          its way; until then, Sync now reads everything since the last sync.
        </p>
      ) : null}

      <ConnectInboxDialog open={flow.connecting} onClose={flow.cancelConnect} />

      {editing ? (
        <InboxEditorDialog
          key={editing.id}
          connection={editing}
          intent={flow.intent}
          online={model.online}
          walletGroups={walletGroups}
          catalog={catalog}
          baseCurrency={base}
          onClose={closeEditor}
        />
      ) : null}

      <DisconnectInboxDialog
        email={flow.pending?.email ?? null}
        busy={flow.busy}
        error={flow.pendingError}
        onConfirm={() => void flow.confirmDisconnect()}
        onClose={flow.cancelDisconnect}
      />
    </div>
  )
}
