import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CloudOff, Crosshair } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import { pickForLine } from '#/features/email-sync/data/mapping'
import { describeTemplate } from '#/features/email-sync/data/ruleDraft'
import {
  groupsForSenders,
  sampleOf,
  similarOf,
} from '#/features/email-sync/data/samples'
import type { SampleGroup } from '#/features/email-sync/data/samples'
import type { EmailRuleEditorModel } from '#/features/email-sync/hooks/useEmailRuleEditor'
import type { InboxSamples } from '#/features/email-sync/hooks/useInboxSamples'
import { useConfigLimits } from '#/lib/config/appConfig'
import type { CurrencyCode } from '#/lib/currency'
import { EditorSection } from './EditorSection'
import { FieldTargetChips } from './FieldTargetChips'
import { GroupPreview } from './GroupPreview'
import { MatchSummary } from './MatchSummary'
import { NumberChoice } from './NumberChoice'
import { ReadingOptions } from './ReadingOptions'
import { ReadingSummary } from './ReadingSummary'
import { RuleFilterForm } from './RuleFilterForm'
import { RuleRoutingForm } from './RuleRoutingForm'
import { SampleLines } from './SampleLines'
import { SamplePicker } from './SamplePicker'

type Props = {
  model: EmailRuleEditorModel
  inbox: InboxSamples
  online: boolean
  walletGroups: WalletGroupOption[]
  baseCurrency: CurrencyCode
}

/**
 * One rule, in four steps: a sample email, what to read from it (proved on the emails that
 * look like it), which emails the rule is for (proved on the inbox's recent mail), and where
 * they go. Desktop: the sample stays beside the steps; phone: stacked, sample first, because a
 * tap on it fills the step below.
 */
export function EmailRuleEditor({
  model,
  inbox,
  online,
  walletGroups,
  baseCurrency,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const limits = useConfigLimits()
  const open = model.open
  const [browsing, setBrowsing] = useState(false)

  // The dialog body is reused from the inbox view and would keep its scroll offset.
  useEffect(() => {
    rootRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  const senders = open?.draft.filter.senders
  const groups = useMemo(
    () => groupsForSenders(inbox.groups, senders ?? []),
    [inbox.groups, senders],
  )
  if (!open) return null

  const { draft, mapping, target } = open
  const sample = mapping.sample
  const selectedGroupId =
    groups.find((g) => g.members.some((m) => m.id === sample?.id))?.id ?? null
  const showPicker = !sample || browsing
  const learned = model.learned
  const amountPick = mapping.picks.amount
  const amountLine =
    sample && amountPick ? (sample.bodyLines[amountPick.line] ?? null) : null
  const rawAmount =
    amountLine &&
    amountPick?.start !== undefined &&
    amountPick.end !== undefined
      ? amountLine.slice(amountPick.start, amountPick.end)
      : (learned?.reading.fields.amount.raw ?? null)
  const problem = model.saveProblems.byRule.get(open.index)
  const learnedNow = model.current && draft.template !== null

  const choose = (group: SampleGroup) => {
    model.chooseSample(
      sampleOf(group.representative),
      similarOf(group, limits.emailRuleSamplesMax),
    )
    setBrowsing(false)
  }
  const tap = (line: number) => {
    if (!sample || !target) return
    model.pick(pickForLine(sample.bodyLines[line] ?? '', line, target))
  }

  return (
    <div
      ref={rootRef}
      className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-[14px] md:sticky md:top-0 md:self-start">
        <EditorSection
          step={1}
          title="A sample email"
          done={sample !== null}
          aside={
            sample && !browsing ? (
              <button
                type="button"
                disabled={!online}
                onClick={() => setBrowsing(true)}
                className="text-[13px] font-bold text-fp-accent-ink hover:underline disabled:opacity-40"
              >
                Change
              </button>
            ) : null
          }
        >
          {model.sampleFailed ? (
            <div role="alert">
              <NoteBox tone="danger">
                Couldn’t load the email you came from. Pick a sample below.
              </NoteBox>
            </div>
          ) : null}
          {showPicker ? (
            online ? (
              <SamplePicker
                inbox={inbox}
                groups={groups}
                selectedGroupId={selectedGroupId}
                onPick={choose}
              />
            ) : (
              <NoteBox tone="neutral" icon={<CloudOff />}>
                Reading your inbox needs a connection.
              </NoteBox>
            )
          ) : null}
          {sample && !browsing ? (
            <>
              {target ? (
                <NoteBox icon={<Crosshair />}>
                  Tap the line with the {target}.
                </NoteBox>
              ) : (
                <NoteBox tone="neutral">
                  All picked. Choose a field under “What to read” to change it.
                </NoteBox>
              )}
              <FieldTargetChips
                target={target}
                picks={mapping.picks}
                options={mapping.options}
                onTarget={model.setTarget}
              />
              <SampleLines
                sample={sample}
                picks={mapping.picks}
                options={mapping.options}
                target={target}
                onTap={tap}
              />
            </>
          ) : null}
        </EditorSection>
      </div>

      <div className="flex min-w-0 flex-col gap-[14px]">
        <EditorSection
          step={2}
          title="How to read it"
          done={learnedNow}
          aside={
            learnedNow ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-fp-accent-soft px-2 py-0.5 text-[11px] font-extrabold tracking-[0.02em] text-fp-accent-ink">
                <Check size={11} strokeWidth={3} />
                Learned
              </span>
            ) : null
          }
        >
          {!sample ? (
            <p className="text-[12.5px] leading-[1.5] text-fp-text-2">
              {draft.template
                ? `${describeTemplate(draft.template)}. Pick a sample email to change it.`
                : 'Pick a sample email first.'}
            </p>
          ) : (
            <>
              {amountLine !== null && amountPick ? (
                <NumberChoice
                  line={amountLine}
                  pick={amountPick}
                  onChoose={(pick) => model.setPick('amount', pick)}
                />
              ) : null}
              <ReadingOptions
                options={mapping.options}
                rawAmount={rawAmount}
                detectedCurrency={learned?.reading.currency ?? null}
                baseCurrency={baseCurrency}
                onDecimal={model.setDecimal}
                onCurrency={model.setCurrency}
              />
              <ReadingSummary
                reading={learned?.reading ?? null}
                defaultMerchant={draft.defaultMerchant.trim() || null}
                pending={model.learning.pending}
                error={model.learnError}
              />
              <GroupPreview
                similar={mapping.similar}
                readings={learned?.similar ?? []}
                pending={model.learning.pending}
              />
            </>
          )}
        </EditorSection>

        <EditorSection
          step={3}
          title="Which emails"
          done={draft.filter.senders.length > 0 && !problem?.senders}
        >
          <RuleFilterForm
            filter={draft.filter}
            onChange={model.editFilter}
            sendersError={problem?.senders}
            termsError={problem?.terms}
          />
          <MatchSummary
            verdicts={model.testing.result}
            focusIndex={model.testFocus}
            messages={inbox.messages}
            pending={model.testing.pending}
            error={model.testing.error}
          />
        </EditorSection>

        <EditorSection step={4} title="File into">
          <RuleRoutingForm
            draft={draft}
            walletGroups={walletGroups}
            onEdit={model.edit}
            problem={problem}
            nameError={model.problems.name}
          />
        </EditorSection>
      </div>
    </div>
  )
}
