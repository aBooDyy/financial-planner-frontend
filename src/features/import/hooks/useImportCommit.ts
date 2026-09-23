import { useCallback, useMemo, useRef, useState } from 'react'
import { messageForApiError } from '#/lib/errorMessages'
import { commitImport } from '#/features/import/data/commit'
import { saveTemplateForImport } from '#/features/import/data/mutations'
import { downloadSkippedRows } from '#/features/import/data/skippedCsv'
import { ONE_TIME_TEMPLATE } from '#/features/import/hooks/useCsvImport'
import type { CommitResult, CommitSource } from '#/features/import/data/commit'
import type { TemplateSaveOutcome } from '#/features/import/data/mutations'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { ReviewRows } from '#/features/import/hooks/useReviewRows'
import type { TemplateSave } from '#/features/import/hooks/useTemplateSave'

/**
 * The commit as state: it drives the wizard from review to `committing` to `done`, and is
 * the single place that decides an import is under way — a second press of the button
 * while the first is running must not write the file twice.
 */

export type CommitState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'done'; result: CommitResult; saved: TemplateSaveOutcome }
  | { status: 'failed'; message: string }

const NOT_SAVED: TemplateSaveOutcome = { kind: 'none' }

export function useImportCommit(
  csv: CsvImport,
  review: ReviewRows,
  save?: TemplateSave,
) {
  const [state, setState] = useState<CommitState>({ status: 'idle' })
  const running = useRef(false)

  const { actions, mapping, file, templateId, matrix } = csv

  /**
   * The rows to write, read out of the file in chunks as the commit reaches them — the
   * commit is the one moment a whole file has to be materialised, and even then only two
   * hundred rows of it at a time.
   */
  const source: CommitSource = useMemo(() => {
    const rows = review.committable
    return {
      total: rows.length,
      cellsAt: (at) => matrix[rows[at]] ?? [],
      rowsAt: (start, end) => review.rowsFor(rows.slice(start, end)),
    }
  }, [review, matrix])
  const session = save?.session ?? null
  const plan = save?.plan ?? null

  const commit = useCallback(async () => {
    if (mapping === null || running.current) return
    running.current = true
    setState({ status: 'running', done: 0, total: source.total })
    actions.goTo('committing')
    try {
      const result = await commitImport(
        source,
        mapping,
        {
          label: file?.name ?? 'Imported file',
          templateId: templateId === ONE_TIME_TEMPLATE ? null : templateId,
          rowCount: review.counts.total,
          skippedDuplicates: review.excludedDuplicates,
          errorCount: review.counts.error,
        },
        (done, total) => setState({ status: 'running', done, total }),
      )
      // The rows are in. A template that cannot be saved is reported on the Done screen,
      // never as a failed import — the two are not the same event.
      let saved = NOT_SAVED
      if (plan !== null && session !== null) {
        try {
          saved = await saveTemplateForImport(plan, session)
        } catch (error) {
          saved = { kind: 'failed', message: messageForApiError(error) }
        }
      }
      setState({ status: 'done', result, saved })
      actions.goTo('done')
    } catch (error) {
      setState({ status: 'failed', message: messageForApiError(error) })
      actions.goTo('review')
    } finally {
      running.current = false
    }
  }, [actions, mapping, file, templateId, review, source, plan, session])

  /** For the person who changes their mind on the Done screen, which is when they know. */
  const saveAsTemplate = useCallback(
    async (name: string) => {
      if (session === null) return
      let saved: TemplateSaveOutcome
      try {
        // The use was already recorded at commit, so this is only the save.
        saved = await saveTemplateForImport(
          { mode: 'new', name },
          { ...session, usedTemplateId: null },
        )
      } catch (error) {
        saved = { kind: 'failed', message: messageForApiError(error) }
      }
      setState((current) =>
        current.status === 'done' ? { ...current, saved } : current,
      )
    },
    [session],
  )

  // Built only when asked for: the file the user downloads is the only reason these rows
  // have to exist at all.
  const downloadSkipped = useCallback(() => {
    if (file === null) return
    downloadSkippedRows(review.rowsFor(review.excluded), file)
  }, [file, review])

  return {
    state,
    commit,
    saveAsTemplate,
    downloadSkipped,
    skippedCount: review.excluded.length,
  }
}

export type ImportCommit = ReturnType<typeof useImportCommit>
