import { useEffect, useMemo, useRef } from 'react'
import { mappingReadiness } from '#/features/import/data/mapping'
import { suggestTemplateName } from '#/features/import/data/templates'
import { useImportCommit } from '#/features/import/hooks/useImportCommit'
import { useReviewRows } from '#/features/import/hooks/useReviewRows'
import { useTemplatePicker } from '#/features/import/hooks/useTemplatePicker'
import { useTemplateSave } from '#/features/import/hooks/useTemplateSave'
import { useUndoImport } from '#/features/import/hooks/useUndoImport'
import { ColumnMappingStep } from './ColumnMappingStep'
import { CommitProgress } from './CommitProgress'
import { FileStep } from './FileStep'
import { ImportDoneCard } from './ImportDoneCard'
import { ImportStepRail } from './ImportStepRail'
import { ReviewStep } from './ReviewStep'
import { UndoImportDialog } from './UndoImportDialog'
import { ValueMappingStep } from './ValueMappingStep'
import { WizardFooter } from './WizardFooter'
import type {
  CsvImport,
  ImportStep,
} from '#/features/import/hooks/useCsvImport'

type Props = { csv: CsvImport }

const HEADINGS: Readonly<Record<ImportStep, string>> = {
  file: 'Choose a file',
  columns: 'What does each column hold?',
  values: 'Match what is in the file to what is in Means',
  review: 'Here is what will be added',
  committing: 'Importing…',
  done: 'Done',
}

/** The accounts a batch's rows landed in, named. */
const walletNamesFor = (
  csv: CsvImport,
  walletIds: ReadonlyArray<string>,
): string[] => {
  const names = new Map<string, string>()
  for (const group of csv.walletGroups) {
    for (const wallet of group.wallets) names.set(wallet.id, wallet.name)
  }
  for (const target of Object.values(csv.mapping?.aliases.wallets ?? {})) {
    if (target.kind === 'create') names.set(target.walletId, target.name)
  }
  return walletIds.map((id) => names.get(id) ?? 'an account')
}

/** The wizard: a rail, one step, and the navigation between them. */
export function CsvImportWizard({ csv }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const { step, draft, actions } = csv

  // The review step's per-row decisions, the template picked in ① and the save choice made
  // in ③ all live above the steps, so they survive stepping away and back — and so the
  // commit reads exactly what the user was shown.
  const review = useReviewRows(csv)
  const picker = useTemplatePicker(csv)
  const save = useTemplateSave(csv, picker)
  const commit = useImportCommit(csv, review, save)
  const undo = useUndoImport()

  useEffect(() => {
    heading.current?.focus()
  }, [step])

  const readiness = draft
    ? mappingReadiness(draft)
    : { ready: false, reason: null }

  const done =
    commit.state.status === 'done'
      ? { ...commit.state.result, saved: commit.state.saved }
      : null

  const walletNames = useMemo(
    () => (done === null ? [] : walletNamesFor(csv, done.batch.walletIds)),
    [csv, done],
  )

  return (
    <div className="flex flex-col gap-4">
      <ImportStepRail
        current={step}
        canGoTo={csv.canGoTo}
        onSelect={actions.goTo}
      />

      <h2
        ref={heading}
        tabIndex={-1}
        className="text-[17px] font-extrabold tracking-[-0.01em] outline-none"
      >
        {HEADINGS[step]}
      </h2>

      {step === 'file' ? (
        <FileStep
          csv={csv}
          templates={picker.options}
          unknown={picker.unknown}
          onContinue={picker.continueTo}
        />
      ) : null}

      {step === 'columns' && draft ? (
        <>
          <ColumnMappingStep csv={csv} draft={draft} />
          <WizardFooter
            onBack={actions.back}
            nextLabel="Next: values"
            onNext={actions.next}
            disabled={!readiness.ready}
            reason={readiness.reason}
          />
        </>
      ) : null}

      {step === 'values' && draft ? (
        <ValueMappingStep
          csv={csv}
          draft={draft}
          save={save}
          onBack={actions.back}
          onNext={actions.next}
        />
      ) : null}

      {step === 'review' && draft ? (
        <>
          {commit.state.status === 'failed' ? (
            <p
              role="alert"
              className="rounded-xl border border-fp-danger/30 bg-fp-danger/10 px-3.5 py-2.5 text-[13px] text-fp-danger"
            >
              {commit.state.message} Nothing was imported — try again.
            </p>
          ) : null}
          <ReviewStep
            csv={csv}
            draft={draft}
            review={review}
            onBack={actions.back}
            onCommit={() => void commit.commit()}
          />
        </>
      ) : null}

      {step === 'committing' && commit.state.status === 'running' ? (
        <CommitProgress done={commit.state.done} total={commit.state.total} />
      ) : null}

      {step === 'done' && done ? (
        <ImportDoneCard
          batch={done.batch}
          walletNames={walletNames}
          learnedSpellings={done.learnedSpellings}
          skippedCount={commit.skippedCount}
          saved={done.saved}
          suggestedName={suggestTemplateName(csv.file?.name ?? '')}
          onSaveTemplate={(name) => void commit.saveAsTemplate(name)}
          onDownloadSkipped={commit.downloadSkipped}
          onImportAnother={actions.reset}
          onUndo={() => void undo.open(done.batch.id)}
        />
      ) : null}

      <UndoImportDialog
        plan={undo.plan}
        busy={undo.busy}
        onClose={undo.close}
        onConfirm={() => void undo.confirm()}
      />
    </div>
  )
}
