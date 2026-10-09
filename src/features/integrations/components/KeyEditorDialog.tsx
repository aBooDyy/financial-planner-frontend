import { useMemo } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
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
import { SkippedShapes } from '#/features/inbound-imports/components/SkippedShapes'
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

  const keyGuard = useDiscardGuard({
    dirty: editor.dirty || rules.dirty,
    close: onClose,
    message:
      'You changed this key’s settings or rules. Closing now loses them.',
  })
  const ruleGuard = useDiscardGuard({
    dirty: rules.openDirty,
    close: () => rules.closeRule(false),
    message: 'You changed this rule. Going back now loses the edits.',
  })

  const ruleView = open !== null
  const title = ruleView ? (
    `Rule · ${open.draft.name.trim() || 'Untitled rule'}`
  ) : (
    <>
      {apiKey.name}{' '}
      <span
        dir="ltr"
        className="font-mono text-[12.5px] font-medium tracking-normal text-fp-text-3"
      >
        {apiKey.tokenPrefix}…
      </span>
    </>
  )

  const footer = ruleView ? (
    <DialogActions
      hint={
        rules.openProblem ??
        `${open.isNew ? 'Done adds it to the list.' : 'Done keeps your edits.'} Save the key to store them.`
      }
      onCancel={ruleGuard.requestClose}
      submitLabel="Done"
      onSubmit={() => rules.closeRule(true)}
      disabled={rules.openProblem !== null}
    />
  ) : (
    <div className="flex w-full flex-col gap-2">
      {general ? (
        <p
          role="alert"
          className="text-center text-[12px] font-semibold text-fp-danger"
        >
          {general}
        </p>
      ) : null}
      <DialogActions
        hint={general ? null : note}
        onCancel={keyGuard.requestClose}
        submitLabel={saving ? 'Saving…' : 'Save'}
        onSubmit={() => void save()}
        disabled={!canSave}
      />
    </div>
  )

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => {
        if (next) return
        if (ruleView) ruleGuard.requestClose()
        else keyGuard.requestClose()
      }}
      title={title}
      onBack={ruleView ? ruleGuard.requestClose : undefined}
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
        <div className="flex flex-col gap-[18px]">
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-[14px]">
              <KeySettingsForm
                editor={editor}
                walletGroups={walletGroups}
                baseCurrency={baseCurrency}
              />
              <SkippedShapes
                parent={{ keyId: apiKey.id }}
                noun={{ one: 'delivery', many: 'deliveries' }}
                online={online}
              />
            </div>
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
      {keyGuard.prompt}
      {ruleGuard.prompt}
    </ResponsiveDialog>
  )
}
