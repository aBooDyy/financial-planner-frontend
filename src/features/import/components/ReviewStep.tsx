import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Checkbox } from '#/components/ui/checkbox'
import { useIsDesktop } from '#/hooks/useMediaQuery'
import { planLabel } from '#/features/import/data/importCounts'
import { categoryTargetGroups } from '#/features/import/data/values'
import { pendingCategoryId } from '#/features/import/data/types'
import { useDuplicateTargets } from '#/features/import/hooks/useDuplicateTargets'
import { useVirtualRows } from '#/hooks/useVirtualRows'
import { formatDate, parseISODate } from '#/lib/date'
import { usePreferencesStore } from '#/stores/preferences'
import { ReviewRow, REVIEW_GRID } from './ReviewRow'
import { ReviewSummaryBar } from './ReviewSummaryBar'
import { RowEditDialog } from './RowEditDialog'
import { ScanProgress } from './ScanProgress'
import { WizardFooter } from './WizardFooter'
import type { MappingDraft } from '#/features/import/data/mapping'
import type { RowLabels } from '#/features/import/data/rowView'
import type { TargetGroup } from '#/features/import/data/values'
import type { CsvImport } from '#/features/import/hooks/useCsvImport'
import type { ReviewRows } from '#/features/import/hooks/useReviewRows'
import type { ParsedRow } from '#/features/import/data/types'

type Props = {
  csv: CsvImport
  draft: MappingDraft
  review: ReviewRows
  onBack: () => void
  onCommit: () => void
}

const DESKTOP_ROW = 56
const MOBILE_ROW = 104

/** Built once: constructing a formatter per render is measurable at ten thousand rows. */
const NUMBER = new Intl.NumberFormat()

/** Rows a Page key moves the cursor by — roughly a screenful at either row height. */
const PAGE_STEP = 8

const CARD =
  'flex flex-col overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

const NO_IDS: string[] = []

const walletGroupsFor = (
  walletGroups: CsvImport['walletGroups'],
  draft: MappingDraft,
): TargetGroup[] => {
  const groups: TargetGroup[] = walletGroups.map((group) => ({
    label: group.label,
    options: group.wallets.map((wallet) => ({
      value: wallet.id,
      label: wallet.name,
      icon: wallet.icon,
      color: wallet.color,
    })),
  }))
  const pending = Object.values(draft.aliases.wallets)
    .filter((target) => target.kind === 'create')
    .map((target) => ({
      value: target.walletId,
      label: `${target.name} · ${target.currency}`,
    }))
  return pending.length === 0
    ? groups
    : [...groups, { label: 'New in this import', options: pending }]
}

const categoryGroupsFor = (
  categories: CsvImport['categories'],
  draft: MappingDraft,
): TargetGroup[] => {
  const nameOf = (id: string): string =>
    categories.find((option) => option.id === id)?.name ?? ''
  const groups = categoryTargetGroups(categories)
  const pending = Object.values(draft.aliases.categories)
    .filter((target) => target.kind === 'create')
    .map((target) => ({
      value: pendingCategoryId(target),
      label:
        target.parentId === null
          ? target.name
          : `${nameOf(target.parentId)} › ${target.name}`,
    }))
  return pending.length === 0
    ? groups
    : [...groups, { label: 'New in this import', options: pending }]
}

/** Step ④: every row as it will be added, and the count that will be. */
export function ReviewStep({ csv, draft, review, onBack, onCommit }: Props) {
  const isDesktop = useIsDesktop()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const nameDuplicate = useDuplicateTargets(
    csv.scan.result?.duplicateIds ?? NO_IDS,
  )
  const [editing, setEditing] = useState<ParsedRow | null>(null)
  const [cursor, setCursor] = useState(0)

  const rowHeight = isDesktop ? DESKTOP_ROW : MOBILE_ROW
  const rowCount = review.visible.length
  const virtual = useVirtualRows({ count: rowCount, rowHeight })
  const { ref } = virtual

  const walletGroups = useMemo(
    () => walletGroupsFor(csv.walletGroups, draft),
    [csv.walletGroups, draft],
  )
  const categoryGroups = useMemo(
    () => categoryGroupsFor(csv.categories, draft),
    [csv.categories, draft],
  )

  const labels: RowLabels = useMemo(() => {
    const wallets = new Map<string, string>()
    for (const group of walletGroups) {
      for (const option of group.options)
        wallets.set(option.value, option.label)
    }
    const categories = new Map<string, string>()
    for (const group of categoryGroups) {
      for (const option of group.options) {
        categories.set(option.value, option.label)
      }
    }
    const merchants = new Map<string, string>()
    for (const merchant of csv.merchantIndex.merchants) {
      merchants.set(merchant.id, merchant.displayName)
    }
    for (const target of Object.values(draft.aliases.merchants)) {
      if (target.kind === 'create') {
        merchants.set(target.merchantId, target.displayName)
      }
    }
    return {
      wallet: (id) => (id === null ? '—' : (wallets.get(id) ?? 'Unknown')),
      category: (id) => categories.get(id) ?? 'Deleted category',
      merchant: (id) => (id === null ? null : (merchants.get(id) ?? null)),
      date: (iso) => {
        const parsed = parseISODate(iso)
        return parsed === null ? iso : formatDate(parsed, dateFormat)
      },
      transaction: nameDuplicate,
    }
  }, [
    walletGroups,
    categoryGroups,
    csv.merchantIndex,
    draft.aliases.merchants,
    dateFormat,
    nameDuplicate,
  ])

  useEffect(() => {
    setCursor(0)
  }, [review.filter])

  // Keep the keyboard cursor on screen without taking focus off the grid itself.
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    const top = cursor * rowHeight
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + rowHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = top + rowHeight - element.clientHeight
    }
  }, [cursor, rowHeight, ref])

  const onKeyDown = (event: KeyboardEvent) => {
    // The controls inside a row own their own keys; only the grid's own navigation is here.
    if (event.target !== event.currentTarget) return
    const last = rowCount - 1
    const move = (to: number) => {
      event.preventDefault()
      setCursor(Math.max(0, Math.min(last, to)))
    }
    if (event.key === 'j' || event.key === 'ArrowDown') move(cursor + 1)
    else if (event.key === 'k' || event.key === 'ArrowUp') move(cursor - 1)
    else if (event.key === 'PageDown') move(cursor + PAGE_STEP)
    else if (event.key === 'PageUp') move(cursor - PAGE_STEP)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(last)
    else if (event.key === ' ' || event.key === 'Enter') {
      const row = review.rowAt(cursor)
      if (row === null) return
      event.preventDefault()
      if (event.key === 'Enter') setEditing(row)
      else if (row.draft !== null) review.toggleRow(row.index, !row.excluded)
    }
  }

  const onToggle = review.toggleRow
  const onEdit = useCallback((row: ParsedRow) => setEditing(row), [])

  const count = review.committable.length
  const number = NUMBER

  // The first pass over a long file takes a moment, and a table reading "0 rows · 0 ready"
  // while it runs would be saying something untrue. Every later pass keeps the result it is
  // replacing on screen, so a background re-scan never takes the step away from the user.
  const firstPass = csv.scan.running && csv.scan.result === null

  // Only the rows on screen are built, so the window is a list of positions, not of rows.
  const page: number[] = []
  if (!firstPass) {
    for (let at = virtual.first; at < virtual.last; at += 1) page.push(at)
  }

  return (
    <>
      {firstPass ? (
        <>
          <ScanProgress done={csv.scan.done} total={csv.scan.total} />
          <WizardFooter
            onBack={onBack}
            nextLabel="Import"
            onNext={onCommit}
            disabled
          />
        </>
      ) : (
        <>
          <ReviewSummaryBar
            counts={review.counts}
            plan={review.plan}
            filter={review.filter}
            onFilter={review.setFilter}
            skipDuplicates={review.skipDuplicates}
            onSkipDuplicates={review.setSkipDuplicates}
          />

          <section className={CARD}>
            <div
              className={`${
                isDesktop ? REVIEW_GRID : 'flex items-center gap-3'
              } border-b border-fp-border bg-fp-surface-2 px-[14px] py-2.5 text-[11.5px] font-semibold text-fp-text-2`}
            >
              <Checkbox
                checked={review.headerChecked}
                aria-label="Include every row shown"
                onCheckedChange={(checked) =>
                  review.setVisibleExcluded(checked !== true)
                }
              />
              {isDesktop ? (
                <>
                  <span>Date</span>
                  <span>Description</span>
                  <span className="text-end">Amount</span>
                  <span>Category</span>
                  <span>Account</span>
                  <span>Status</span>
                  <span />
                </>
              ) : (
                <span>
                  {number.format(rowCount)} rows shown · tap ✎ to fix one
                </span>
              )}
            </div>

            <p id="review-grid-help" className="sr-only">
              Use the arrow keys, or j and k, to move between rows; Page Up,
              Page Down, Home and End jump further. Space includes or excludes
              the row under the cursor, and Enter opens it for editing.
            </p>

            {rowCount === 0 ? (
              <p className="px-[14px] py-6 text-center text-[13px] text-fp-text-2">
                No rows match this filter.
              </p>
            ) : (
              <div
                ref={ref}
                role="grid"
                tabIndex={0}
                aria-label="Rows to import"
                aria-describedby="review-grid-help"
                aria-rowcount={rowCount}
                aria-activedescendant={`review-row-${cursor}`}
                onScroll={virtual.onScroll}
                onKeyDown={onKeyDown}
                className="max-h-[min(58vh,560px)] overflow-y-auto outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/25"
              >
                <div
                  role="rowgroup"
                  style={{
                    paddingBlockStart: virtual.padStart,
                    paddingBlockEnd: virtual.padEnd,
                  }}
                >
                  {page.map((position) => {
                    const row = review.rowAt(position)
                    return row === null ? null : (
                      <ReviewRow
                        key={row.index}
                        id={`review-row-${position}`}
                        rowIndex={position + 1}
                        row={row}
                        labels={labels}
                        active={position === cursor}
                        height={rowHeight}
                        compact={!isDesktop}
                        onToggle={onToggle}
                        onEdit={onEdit}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <p className="text-[12px] text-fp-text-3">
            Arrows (or j and k) move the cursor, space includes or excludes that
            row, and Enter opens it. Nothing is written until you import.
          </p>

          <WizardFooter
            onBack={onBack}
            nextLabel={`Import ${planLabel(review.plan)}`}
            onNext={onCommit}
            disabled={count === 0}
            reason={
              count === 0
                ? 'Nothing is selected — include at least one row, or fix the ones with errors.'
                : null
            }
          />
        </>
      )}

      {/* Deliberately outside the branch above: a pass landing underneath an open editor
          must not unmount it and take the correction being typed with it. */}
      <RowEditDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSave={review.editRow}
        wallets={walletGroups}
        categories={categoryGroups}
        baseCurrency={csv.baseCurrency}
        defaults={draft.defaults}
      />
    </>
  )
}
