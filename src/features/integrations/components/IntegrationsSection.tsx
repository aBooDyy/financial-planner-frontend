import { useMemo } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { CloudOff, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { walletGroupOptions } from '#/features/balances/data/selectors'
import { useBalances } from '#/features/balances/hooks/useBalances'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import { useIntegrationKeys } from '#/features/integrations/hooks/useIntegrationKeys'
import { useKeyFlow } from '#/features/integrations/hooks/useKeyFlow'
import { SectionHeader } from '#/features/settings/components/SectionHeader'
import { useConfigLimits, useIntegrationsConfig } from '#/lib/config/appConfig'
import { apiOriginUrl } from '#/lib/http'
import { ConfirmKeyActionDialog } from './ConfirmKeyActionDialog'
import { CreateKeyDialog } from './CreateKeyDialog'
import { EndpointCard } from './EndpointCard'
import { KeyEditorDialog } from './KeyEditorDialog'
import { KeyList } from './KeyList'
import { NoKeysCard } from './NoKeysCard'
import { TokenRevealDialog } from './TokenRevealDialog'

/** Read through the route API rather than the route module, which imports this component. */
const settingsRoute = getRouteApi('/settings/integrations')

export function IntegrationsSection() {
  const model = useIntegrationKeys()
  const search = settingsRoute.useSearch()
  const navigate = useNavigate()
  const flow = useKeyFlow(model, search.key)
  const closeEditor = () => {
    flow.closeEditor()
    if (search.key) {
      void navigate({ to: '/settings/integrations', search: {}, replace: true })
    }
  }
  const { nodes, base } = useBalances()
  const catalog = useCategoryCatalog()

  const walletGroups = useMemo(() => walletGroupOptions(nodes), [nodes])
  const walletNames = useMemo(
    () =>
      new Map(
        walletGroups.flatMap((g) => g.wallets.map((w) => [w.id, w.name])),
      ),
    [walletGroups],
  )
  const integrations = useIntegrationsConfig()
  const { integrationKeysMax } = useConfigLimits()
  const atKeyCap = model.keys.length >= integrationKeysMax
  // The deployment's public URL when it names one, else wherever this app reaches the API.
  const endpoint = useMemo(
    () => integrations.webhookUrl ?? apiOriginUrl(integrations.webhookPath),
    [integrations],
  )
  const editing = model.keys.find((k) => k.id === flow.editingId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Integrations"
        subtitle="Let other apps log transactions into Means."
      />

      <EndpointCard endpoint={endpoint} />

      {!model.online ? (
        <p
          role="status"
          className="flex items-center gap-2 text-[12.5px] text-fp-text-2"
        >
          <CloudOff size={15} strokeWidth={1.8} className="shrink-0" />
          You’re offline. These are your keys as of the last sync — creating or
          changing one needs the server.
        </p>
      ) : model.stale ? (
        <p role="status" className="text-[12.5px] text-fp-text-2">
          Couldn’t refresh your keys. Showing the last copy on this device.
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-extrabold">Keys</h2>
        {model.keys.length > 0 ? (
          <Button
            type="button"
            disabled={!model.online || atKeyCap}
            onClick={() => flow.startCreate()}
            className="gap-1.5 px-4 py-[9px] text-[13.5px]"
          >
            <Plus size={15} strokeWidth={2.2} />
            New key
          </Button>
        ) : null}
      </div>

      {atKeyCap ? (
        <p className="text-[12.5px] text-fp-text-2">
          You have {integrationKeysMax} keys, the most a person can hold. Delete
          one you no longer use to make another.
        </p>
      ) : null}

      {model.loading ? null : model.keys.length === 0 ? (
        <NoKeysCard canCreate={model.online} onCreate={flow.startCreate} />
      ) : (
        <KeyList
          keys={model.keys}
          walletNames={walletNames}
          online={model.online}
          onEdit={flow.edit}
          onRotate={(k) => flow.ask('rotate', k)}
          onRevoke={(k) => flow.ask('revoke', k)}
          onDelete={(k) => flow.ask('delete', k)}
        />
      )}

      {flow.creating ? (
        <CreateKeyDialog
          key={flow.creating.session}
          open
          initialName={flow.creating.name}
          online={model.online}
          walletGroups={walletGroups}
          create={model.create}
          onCreated={flow.onCreated}
          onClose={flow.cancelCreate}
        />
      ) : null}

      <TokenRevealDialog
        token={flow.reveal?.token ?? null}
        title={flow.reveal?.kind === 'rotated' ? 'New secret' : 'Key created'}
        continueLabel={
          flow.reveal?.kind === 'rotated'
            ? 'I’ve copied it'
            : 'I’ve copied it — set it up'
        }
        onContinue={flow.finishReveal}
      />

      {editing ? (
        <KeyEditorDialog
          key={editing.id}
          apiKey={editing}
          fresh={flow.editingFresh}
          sampleImportId={editing.id === search.key ? search.sample : undefined}
          online={model.online}
          walletGroups={walletGroups}
          catalog={catalog}
          baseCurrency={base}
          update={model.update}
          onClose={closeEditor}
        />
      ) : null}

      <ConfirmKeyActionDialog
        action={flow.pending?.action ?? null}
        keyName={flow.pending?.key.name ?? ''}
        busy={flow.busy}
        error={flow.pendingError}
        onConfirm={() => void flow.confirm()}
        onClose={flow.cancelPending}
      />
    </div>
  )
}
