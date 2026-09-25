import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Undo2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { batchPlan, planPhrase } from '#/features/import/data/importCounts'
import { useImportBatch } from '#/features/import/hooks/useImportHistory'
import type { LocalImportBatch } from '#/db/types'
import type { TemplateSaveOutcome } from '#/features/import/data/mutations'

type Props = {
  batch: LocalImportBatch
  /** The accounts the rows landed in, already resolved to names. */
  walletNames: ReadonlyArray<string>
  learnedSpellings: number
  skippedCount: number
  /** What became of the mapping — the footer's choice, carried out. */
  saved: TemplateSaveOutcome
  suggestedName: string
  onSaveTemplate: (name: string) => void
  onDownloadSkipped: () => void
  onImportAnother: () => void
  onUndo: () => void
}

const CARD =
  'flex flex-col gap-3 rounded-2xl border border-fp-border bg-fp-surface p-[18px] shadow-fp'

const list = (names: ReadonlyArray<string>): string => {
  if (names.length === 0) return 'your accounts'
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The payoff: what landed, what did not, and the three things to do next. */
export function ImportDoneCard({
  batch,
  walletNames,
  learnedSpellings,
  skippedCount,
  saved,
  suggestedName,
  onSaveTemplate,
  onDownloadSkipped,
  onImportAnother,
  onUndo,
}: Props) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState(suggestedName)
  // The batch handed in is the commit's own snapshot; undo writes to the record behind it.
  const undone = (useImportBatch(batch.id) ?? batch).undoneAt !== null
  const number = new Intl.NumberFormat()
  const notes: string[] = []
  if (batch.skippedDuplicates > 0) {
    notes.push(`${number.format(batch.skippedDuplicates)} duplicates skipped`)
  }
  if (batch.errorCount > 0) {
    notes.push(
      `${number.format(batch.errorCount)} rows with errors were not imported`,
    )
  }
  if (learnedSpellings > 0) {
    notes.push(
      learnedSpellings === 1
        ? '1 new merchant spelling learned'
        : `${number.format(learnedSpellings)} new merchant spellings learned`,
    )
  }

  return (
    <section className={CARD}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
            undone
              ? 'bg-fp-surface-2 text-fp-text-2'
              : 'bg-fp-accent-soft text-fp-accent-ink'
          }`}
        >
          {undone ? (
            <Undo2 size={19} strokeWidth={1.9} />
          ) : (
            <CheckCircle2 size={19} strokeWidth={1.9} />
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-[15px] font-bold">
            {undone
              ? 'Import undone.'
              : `${planPhrase(batchPlan(batch))} imported into ${list(walletNames)}.`}
          </h3>
          {undone ? (
            <p className="text-[13px] text-fp-text-2">
              What it added was removed — anything you had changed since was
              kept, along with the accounts, categories and merchants it
              created.
            </p>
          ) : notes.length > 0 ? (
            <p className="text-[13px] text-fp-text-2">{notes.join(' · ')}</p>
          ) : null}
          <p className="text-[13px] text-fp-text-3">
            {saved.kind === 'saved'
              ? `Mapping saved as “${saved.name}”.`
              : saved.kind === 'updated'
                ? `Mapping “${saved.name}” updated.`
                : saved.kind === 'failed'
                  ? `The mapping wasn’t saved — ${saved.message}`
                  : 'This was a one-time mapping — nothing was saved.'}
          </p>

          {saved.kind === 'saved' ||
          saved.kind === 'updated' ? null : naming ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={name}
                autoFocus
                aria-label="Template name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim())
                    onSaveTemplate(name.trim())
                  if (e.key === 'Escape') setNaming(false)
                }}
                className="w-[230px] rounded-[9px] border-fp-border-strong px-2.5 py-1.5 text-[13px]"
              />
              <Button
                type="button"
                disabled={name.trim() === ''}
                className="px-[13px] py-[8px] text-[12.5px]"
                onClick={() => onSaveTemplate(name.trim())}
              >
                Save template
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="self-start text-[12.5px] font-semibold text-fp-accent-ink underline-offset-2 hover:underline"
              onClick={() => setNaming(true)}
            >
              Save it as a template
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 border-t border-fp-border pt-3.5">
        {undone ? null : (
          <Button asChild className="px-[15px] py-[10px] text-[13.5px]">
            <Link to="/transactions">
              See them in Spending
              <ArrowRight
                size={15}
                strokeWidth={2}
                className="rtl:-scale-x-100"
              />
            </Link>
          </Button>
        )}
        <Button
          type="button"
          variant={undone ? 'default' : 'outline'}
          className="px-[14px] py-[9px] text-[13px]"
          onClick={onImportAnother}
        >
          Import another file
        </Button>
        {skippedCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="px-[14px] py-[9px] text-[13px]"
            onClick={onDownloadSkipped}
          >
            Download skipped rows
          </Button>
        ) : null}
        {undone ? null : (
          <Button
            type="button"
            variant="ghost"
            className="px-[14px] py-[9px] text-[13px] text-fp-danger"
            onClick={onUndo}
          >
            Undo this import
          </Button>
        )}
      </div>
    </section>
  )
}
