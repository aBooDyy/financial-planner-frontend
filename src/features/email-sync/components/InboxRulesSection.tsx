import { useState } from 'react'
import { ListFilter, Plus } from 'lucide-react'
import { ConfirmDialog } from '#/components/dialog/ConfirmDialog'
import { NoteBox } from '#/components/dialog/NoteBox'
import { EmptyState } from '#/components/EmptyState'
import { fallbackName } from '#/features/email-sync/data/ruleDraft'
import { handledCounts } from '#/features/email-sync/data/verdicts'
import type { EmailRuleEditorModel } from '#/features/email-sync/hooks/useEmailRuleEditor'
import { EmailRuleList } from './EmailRuleList'
import { SmallButton } from './SmallButton'

type Props = {
  model: EmailRuleEditorModel
  /** Changes are not possible right now (offline). */
  locked: boolean
  walletNames: ReadonlyMap<string, string>
}

/** The inbox editor's rules pane: the ordered list, and how the inbox's recent mail fares. */
export function InboxRulesSection({ model, locked, walletNames }: Props) {
  const { rules, testing } = model
  const [removing, setRemoving] = useState<number | null>(null)
  const verdicts = testing.result
  const handled = verdicts ? handledCounts(verdicts, rules.length) : null
  const flagged = new Set(model.saveProblems.byRule.keys())
  const caught = handled?.reduce((sum, n) => sum + n, 0) ?? null
  const doomed = removing === null ? undefined : rules[removing]

  return (
    <section
      aria-labelledby="inbox-rules-heading"
      className="flex flex-col gap-[10px]"
    >
      <div>
        <div className="flex items-center gap-2">
          <h3
            id="inbox-rules-heading"
            className="flex-1 text-[15px] font-extrabold"
          >
            Rules
          </h3>
          {model.status === 'ready' ? (
            <span className="text-[12.5px] font-semibold text-fp-text-3 tabular-nums">
              <bdi>
                {rules.length} of {model.rulesMax}
              </bdi>
            </span>
          ) : null}
        </div>
        <p className="mt-[3px] text-[12.5px] leading-[1.45] text-fp-text-2">
          Each rule picks out some of this inbox’s emails, reads them, and files
          them into an account. Checked in order; the first that matches wins.
        </p>
      </div>

      {model.status === 'loading' ? (
        <p className="text-[12.5px] text-fp-text-3">Loading rules…</p>
      ) : model.status === 'failed' ? (
        <NoteBox tone="danger">
          <div className="flex flex-wrap items-center gap-3">
            <span role="alert" className="flex-1">
              Couldn’t load this inbox’s rules.
            </span>
            <SmallButton type="button" onClick={model.reload}>
              Try again
            </SmallButton>
          </div>
        </NoteBox>
      ) : (
        <>
          {rules.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              size="sm"
              framed
              title="No rules yet"
              text="Nothing is read from this inbox until you add one from an alert your bank sent you."
            />
          ) : (
            <EmailRuleList
              rules={rules}
              walletNames={walletNames}
              handled={handled}
              flagged={flagged}
              disabled={locked}
              onOpen={model.openRule}
              onToggle={model.toggleEnabled}
              onRemove={setRemoving}
              onMove={model.move}
            />
          )}
          {verdicts && caught !== null && rules.length > 0 ? (
            <div role="status">
              <NoteBox>
                Your rules pick up {caught} of the {verdicts.length} most recent
                emails in this inbox.
              </NoteBox>
            </div>
          ) : null}
          {model.conflict ? (
            <NoteBox tone="danger">
              <div className="flex flex-wrap items-center gap-3">
                <span role="alert" className="flex-1">
                  These rules were changed somewhere else. Reload them to carry
                  on — your edits here will be lost.
                </span>
                <SmallButton type="button" onClick={model.reload}>
                  Reload rules
                </SmallButton>
              </div>
            </NoteBox>
          ) : null}
          <div>
            <SmallButton
              type="button"
              variant="ghost"
              disabled={locked || !model.canAddRule}
              onClick={model.add}
              className="border-[1.5px] border-transparent bg-fp-accent-soft text-fp-accent-ink hover:bg-fp-accent-soft hover:text-fp-accent-ink hover:brightness-95"
            >
              <Plus size={15} strokeWidth={2.4} />
              Add rule
            </SmallButton>
          </div>
          {!model.canAddRule ? (
            <p className="text-[12px] text-fp-text-3">
              An inbox can have up to {model.rulesMax} rules.
            </p>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={doomed !== undefined}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={doomed ? `Delete “${fallbackName(doomed)}”?` : 'Delete rule?'}
        bullets={[
          'It stops reading this inbox’s emails; they fall to the next rule in the list.',
          'Transactions it already logged stay in your ledger.',
        ]}
        note="It’s removed when you save the inbox."
        confirmLabel="Delete"
        onConfirm={() => {
          if (removing !== null) model.remove(removing)
          setRemoving(null)
        }}
      />
    </section>
  )
}
