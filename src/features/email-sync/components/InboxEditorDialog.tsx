import { useMemo } from 'react'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import type { LocalEmailConnection } from '#/db/types'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import { PROVIDER_LABEL } from '#/features/email-sync/data/describe'
import { fallbackName } from '#/features/email-sync/data/ruleDraft'
import { sampleOf } from '#/features/email-sync/data/samples'
import { useEmailRuleEditor } from '#/features/email-sync/hooks/useEmailRuleEditor'
import type { EmailRuleEditorModel } from '#/features/email-sync/hooks/useEmailRuleEditor'
import type { EditorIntent } from '#/features/email-sync/hooks/useInboxFlow'
import { useInboxSamples } from '#/features/email-sync/hooks/useInboxSamples'
import { useInboxSettings } from '#/features/email-sync/hooks/useInboxSettings'
import type { CurrencyCode } from '#/lib/currency'
import { EditorFooter } from './EditorFooter'
import { EmailRuleEditor } from './EmailRuleEditor'
import { InboxPendingList } from './InboxPendingList'
import { InboxRulesSection } from './InboxRulesSection'
import { InboxSettingsForm } from './InboxSettingsForm'

type Props = {
  connection: LocalEmailConnection
  intent: EditorIntent
  online: boolean
  walletGroups: WalletGroupOption[]
  baseCurrency: CurrencyCode
  onClose: () => void
}

/** Why Done is not available yet for the open rule, or null when it is. */
function doneBlocker(model: EmailRuleEditorModel): string | null {
  const { problems, learning } = model
  if (problems.template) return problems.template
  if (!model.current)
    return learning.pending
      ? 'Reading your sample…'
      : (model.learnError ?? 'Tag the amount and currency in step 1.')
  return problems.senders ?? problems.name ?? problems.autoConfirm ?? null
}

/**
 * The inbox's settings on the start side, its rules on the end, what it left for review under
 * both; stacked on a phone. Opening a rule swaps the body for the rule editor, whose Done folds
 * the rule back into the set. One Save stores whatever changed — the settings PATCH, the whole
 * rule set in one PUT, or both.
 */
export function InboxEditorDialog({
  connection,
  intent,
  online,
  walletGroups,
  baseCurrency,
  onClose,
}: Props) {
  const settings = useInboxSettings(connection)
  const inbox = useInboxSamples(connection.id, online)
  const samples = useMemo(() => inbox.messages.map(sampleOf), [inbox.messages])
  const rules = useEmailRuleEditor({
    connectionId: connection.id,
    online,
    samples,
    startWithNewRule: intent.fresh,
    fix: intent.fix,
  })
  const walletNames = useMemo(
    () =>
      new Map(
        walletGroups.flatMap((g) => g.wallets.map((w) => [w.id, w.name])),
      ),
    [walletGroups],
  )
  const inboxGuard = useDiscardGuard({
    dirty: settings.dirty || rules.dirty,
    close: onClose,
    message: 'Closing now loses the changes to this inbox and its rules.',
  })
  const ruleGuard = useDiscardGuard({
    dirty: rules.ruleEdited,
    close: () => rules.closeRule(false),
    message: 'Going back now loses the changes to this rule.',
  })

  const open = rules.open
  const saving = settings.saving || rules.saving
  const canSave =
    online && !saving && (settings.dirty || rules.dirty) && !rules.conflict
  const general = settings.error ?? rules.saveProblems.general
  const note = !online
    ? 'You’re offline. Changes need the server.'
    : rules.dirty
      ? 'Rule changes aren’t saved yet.'
      : ''

  const save = async () => {
    if (!(await settings.save())) return
    if (await rules.save()) onClose()
  }

  const blocker = open ? doneBlocker(rules) : null

  const title = open ? (
    `Rule · ${fallbackName(open.draft)}`
  ) : (
    <>
      <bdi>{connection.email}</bdi>{' '}
      <span className="text-[13px] font-semibold tracking-normal text-fp-text-3">
        {PROVIDER_LABEL[connection.provider]}
      </span>
    </>
  )

  const footer = open ? (
    <EditorFooter
      hint={
        blocker ??
        `${open.isNew ? 'Done adds it to the list.' : 'Done keeps your edits.'} Save the inbox to store them.`
      }
      onCancel={ruleGuard.requestClose}
      submitLabel="Done"
      onSubmit={() => rules.closeRule(true)}
      disabled={blocker !== null}
    />
  ) : (
    <EditorFooter
      hint={note}
      error={general}
      onCancel={inboxGuard.requestClose}
      submitLabel={saving ? 'Saving…' : 'Save'}
      onSubmit={() => void save()}
      disabled={!canSave}
    />
  )

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(next) => {
          if (next) return
          if (open) ruleGuard.requestClose()
          else inboxGuard.requestClose()
        }}
        title={title}
        onBack={open ? ruleGuard.requestClose : undefined}
        contentClassName="sm:max-w-[960px]"
        sheetClassName="h-[96%] max-h-[96%]"
        footer={footer}
      >
        {open ? (
          <EmailRuleEditor
            model={rules}
            inbox={inbox}
            online={online}
            walletGroups={walletGroups}
            baseCurrency={baseCurrency}
          />
        ) : (
          <div className="flex flex-col gap-[18px]">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <InboxSettingsForm
                connection={connection}
                editor={settings}
                online={online}
              />
              <div className="md:sticky md:top-0 md:self-start">
                <InboxRulesSection
                  model={rules}
                  locked={!online}
                  walletNames={walletNames}
                />
              </div>
            </div>
            <InboxPendingList connectionId={connection.id} />
          </div>
        )}
      </ResponsiveDialog>
      {inboxGuard.prompt}
      {ruleGuard.prompt}
    </>
  )
}
