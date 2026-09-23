import { FileSpreadsheet, SlidersHorizontal } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { DateFormatToken } from '#/features/import/data/csv/dates'
import type { ImportFileInfo } from '#/features/import/hooks/useCsvImport'

type Props = {
  file: ImportFileInfo
  dateFormat: DateFormatToken | null
  dateAmbiguous: boolean
  onAdjust: () => void
  onChangeFile: () => void
}

export const delimiterLabel = (delimiter: string): string =>
  delimiter === '\t' ? 'Tab' : delimiter === ' ' ? 'Space' : delimiter

const fileSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024)
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const FACT = 'whitespace-nowrap'

/** What detection decided about the file, in one line the user can argue with. */
export function FileSummaryCard({
  file,
  dateFormat,
  dateAmbiguous,
  onAdjust,
  onChangeFile,
}: Props) {
  const { dialect } = file

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-fp-accent-soft text-fp-accent-ink">
          <FileSpreadsheet size={19} strokeWidth={1.8} />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[15.5px] font-extrabold tracking-[-0.01em]">
          {file.name}
        </h2>
        <span className="shrink-0 text-[12.5px] text-fp-text-3 tabular-nums">
          {fileSize(file.size)} ·{' '}
          {new Intl.NumberFormat().format(file.rowCount)} rows
        </span>
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-fp-text-2">
        <span className={FACT}>
          Delimiter <b dir="ltr">{delimiterLabel(dialect.delimiter)}</b>
        </span>
        <span className={FACT}>
          Encoding <b>{dialect.encoding}</b>
        </span>
        <span className={FACT}>
          Header row <b>{dialect.hasHeader ? dialect.skipRows + 1 : 'none'}</b>
        </span>
        <span className={FACT}>
          Dates <b dir="ltr">{dateFormat ?? '—'}</b>
          {dateAmbiguous ? (
            <span className="text-fp-danger"> · check this</span>
          ) : null}
        </span>
        <span className={FACT}>
          Decimal <b dir="ltr">{dialect.decimal}</b>
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-[7px] px-[14px] py-[9px] text-[13px]"
          onClick={onAdjust}
        >
          <SlidersHorizontal size={15} strokeWidth={1.9} aria-hidden />
          Adjust
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-[14px] py-[9px] text-[13px]"
          onClick={onChangeFile}
        >
          Choose another file
        </Button>
      </div>
    </section>
  )
}
