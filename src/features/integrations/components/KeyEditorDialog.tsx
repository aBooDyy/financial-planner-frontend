import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { WalletGroupOption } from '#/features/balances/data/selectors'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type {
  IntegrationKey,
  KeySettings,
} from '#/features/integrations/api/types'
import type { KeyOutcome } from '#/features/integrations/hooks/useIntegrationKeys'
import { useKeyEditor } from '#/features/integrations/hooks/useKeyEditor'
import { useRuleEditor } from '#/features/integrations/hooks/useRuleEditor'
import { useConfigLimits } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'
import { DeliveryLog } from './DeliveryLog'
import { KeyRulesSection } from './KeyRulesSection'
import { KeySettingsForm } from './KeySettingsForm'
import { RuleEditor } from './RuleEditor'

type Props = {
  apiKey: IntegrationKey
  /** Just created: open straight onto a first rule. */
  fresh?: boolean
  /** A staged import to test the rules against, opened from the review queue. */
  sampleImportId?: string
  online: boolean
  walletGroups: WalletGroupOption[]
  catalog: CategoryCatalog
  baseCurrency: CurrencyCode
  update: (
    key: IntegrationKey,
    settings: KeySettings,
  ) => Promise<KeyOutcome<IntegrationKey>>
  onClose: () => void
}

/**
 * Settings on the start side, rules on the end, the delivery log under both; stacked on a
 * phone. Opening a rule swaps the body for the rule editor, whose Done folds the rule back
 * into the set. One Save stores whatever changed — the settings PATCH, the whole rule set in
 * one PUT, or both.
 */
export function KeyEditorDialog({
  apiKey,
  fresh = false,
  sampleImportId,
  online,
  walletGroups,
  catalog,
  baseCurrency,
  update,
  onClose,
}: Props) {
  const editor = useKeyEditor(apiKey, update)
  const rules = useRuleEditor({
    keyId: apiKey.id,
    online,
    startWithNewRule: fresh,
    sampleImportId,
  })
  const limits = useConfigLimits()
  const walletNames = useMemo(
    () =>
      new Map(
        walletGroups.flatMap((g) => g.wallets.map((w) => [w.id, w.name])),
      ),
    [walletGroups],
  )
  const revoked = apiKey.status === 'revoked'
  const open = rules.open
  const saving = editor.saving || rules.saving
  const settingsOk = !editor.dirty || editor.canSave
  const canSave =
    online && !revoked && !saving && settingsOk && (editor.dirty || rules.dirty)

  const note = revoked
    ? 'This key is revoked. Rotate it to use it again.'
    : !online
      ? 'You’re offline. Changes need the server.'
      : rules.dirty
        ? 'Rule changes aren’t saved yet.'
        : ''
  const general = editor.general ?? rules.saveProblems.general

  const save = async () => {
    if (editor.dirty && !(await editor.save())) return
    if (await rules.save()) onClose()
  }

  const ruleView = open !== null
  const title = ruleView ? (
    <span className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Back to the key"
        onClick={() => rules.closeRule(false)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-fp-surface-2 text-fp-text-2 hover:text-fp-text"
      >
        <ChevronLeft size={17} strokeWidth={2} className="rtl:rotate-180" />
      </button>
      <span className="truncate">
        Rule · {open.draft.name.trim() || 'Untitled rule'}
      </span>
    </span>
  ) : (
    <span className="flex flex-wrap items-baseline gap-x-3">
      <span>{apiKey.name}</span>
      <span
        dir="ltr"
        className="font-mono text-[12.5px] font-normal text-fp-text-3"
      >
        {apiKey.tokenPrefix}…
      </span>
    </span>
  )

  const footer = ruleView ? (
    <>
      <span className="flex-1 text-[12px] text-fp-text-3">
        {open.isNew ? 'Done adds it to the list.' : 'Done keeps your edits.'}{' '}
        Save the key to store them.
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={() => rules.closeRule(false)}
      >
        Cancel
      </Button>
      <Button type="button" onClick={() => rules.closeRule(true)}>
        Done
      </Button>
    </>
  ) : (
    <>
      <span
        role={general ? 'alert' : undefined}
        className={`flex-1 text-[12px] ${general ? 'text-fp-danger' : 'text-fp-text-3'}`}
      >
        {general ?? note}
      </span>
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button type="button" disabled={!canSave} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (next) return
        if (ruleView) rules.closeRule(false)
        else onClose()
      }}
      title={title}
      contentClassName="sm:max-w-[920px]"
      sheetClassName="h-[96%] max-h-[96%]"
      footer={footer}
    >
      {ruleView ? (
        <RuleEditor
          model={rules}
          apiKey={apiKey}
          online={online}
          walletNames={walletNames}
          catalog={catalog}
          choices={{ walletGroups, catalog, baseCurrency }}
          maxBytes={limits.integrationPayloadMaxBytes}
        />
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <KeySettingsForm
              editor={editor}
              walletGroups={walletGroups}
              catalog={catalog}
              baseCurrency={baseCurrency}
            />
            <div className="md:sticky md:top-0 md:self-start">
              <KeyRulesSection model={rules} locked={revoked || !online} />
            </div>
          </div>
          <DeliveryLog
            apiKey={apiKey}
            online={online}
            walletNames={walletNames}
            catalog={catalog}
            onBuild={(payload, delivery) =>
              rules.startFromPayload(payload, delivery.ruleId)
            }
          />
        </div>
      )}
    </ResponsiveDialog>
  )
}
