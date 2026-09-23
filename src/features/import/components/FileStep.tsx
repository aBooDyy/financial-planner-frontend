import { useState } from 'react'
import { DialectDialog } from './DialectDialog'
import { FileDropZone } from './FileDropZone'
import { FileSummaryCard } from './FileSummaryCard'
import { TemplateNotice } from './TemplateNotice'
import { TemplatePicker } from './TemplatePicker'
import { WizardFooter } from './WizardFooter'
import type { TemplateOption } from './TemplatePicker'
import type { UnknownAlias } from '#/features/import/data/templates'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'

type Props = {
  csv: CsvImport
  templates?: ReadonlyArray<TemplateOption>
  /** What the applied template could not restore — reported here, at apply time. */
  unknown?: ReadonlyArray<UnknownAlias>
  onContinue: () => void
}

/** Step ①: the file, how it was read, and which mapping to read it with. */
export function FileStep({
  csv,
  templates = [],
  unknown = [],
  onContinue,
}: Props) {
  const [adjusting, setAdjusting] = useState(false)
  const { file, read, draft, actions } = csv

  if (file === null || draft === null) {
    return (
      <FileDropZone
        read={read}
        onFile={actions.openFile}
        onCancel={actions.cancelRead}
      />
    )
  }

  return (
    <>
      <FileSummaryCard
        file={file}
        dateFormat={draft.dateFormat}
        dateAmbiguous={draft.dateAmbiguous}
        onAdjust={() => setAdjusting(true)}
        onChangeFile={actions.reset}
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-fp-border bg-fp-surface p-[18px] shadow-fp">
        <h3 className="text-[14px] font-bold">How should we read it?</h3>
        <TemplatePicker
          templates={templates}
          value={csv.templateId}
          onChange={actions.chooseTemplate}
        />
        <TemplateNotice unknown={unknown} />
      </section>

      <WizardFooter
        nextLabel="Continue"
        onNext={onContinue}
        disabled={read.status === 'reading'}
      />

      <DialectDialog
        open={adjusting}
        onOpenChange={setAdjusting}
        file={file}
        read={read}
        onChange={actions.setDialect}
      />
    </>
  )
}
