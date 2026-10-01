import { useMemo } from 'react'
import type { LocalTransaction } from '#/db/types'
import { IconChip } from '#/components/icons/IconChip'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { buildCategoryTxns } from '#/features/reports/data/categoryTxns'
import type { CategoryPick } from '#/features/reports/data/categoryTxns'
import type { ReportRange } from '#/features/reports/data/range'
import { ConnectedTxEditor } from '#/features/transactions/components/ConnectedTxEditor'
import { SkeletonRows } from '#/features/transactions/components/SkeletonRows'
import { ActivityGroups } from '#/features/transactions/components/TransactionList'
import {
  parseISO,
  startOfToday,
  ymd,
} from '#/features/transactions/data/planning'
import type { ActivityRow, Scope } from '#/features/transactions/data/selectors'
import { useTransactions } from '#/features/transactions/hooks/useTransactions'
import { useTxEditor } from '#/features/transactions/hooks/useTxEditor'
import { usePreferencesStore } from '#/stores/preferences'

type Props = {
  pick: CategoryPick
  /** The report's ledger rows; null while a new period loads. */
  rows: ReadonlyArray<LocalTransaction> | null
  scope: Scope
  range: ReportRange
  onClose: () => void
}

/**
 * Every transaction behind one breakdown row, drawn as Spending's Activity list. A row
 * opens the transaction editor over it; the list follows the edit live.
 */
export function CategoryTransactionsDialog({
  pick,
  rows,
  scope,
  range,
  onClose,
}: Props) {
  const {
    loading,
    base,
    inputs,
    deltas,
    catalog,
    editorWallets,
    archivedWalletIds,
    goals,
  } = useTransactions()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const todayKey = ymd(startOfToday())
  const editor = useTxEditor(
    editorWallets,
    base,
    inputs.rates,
    archivedWalletIds,
  )

  const view = useMemo(
    () =>
      rows && !loading
        ? buildCategoryTxns({
            rows,
            pick,
            catalog,
            scope,
            period: range,
            today: parseISO(todayKey),
            inputs,
            dateFormat,
          })
        : null,
    [rows, loading, pick, catalog, scope, range, todayKey, inputs, dateFormat],
  )

  const root = catalog.get(pick.rootId)
  const openRow = (row: ActivityRow) => {
    const t = rows?.find((x) => x.id === row.id && x.deleted === 0)
    if (t) editor.openEditTx(t)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={view?.title ?? root.name}
      description={range.caption}
      contentClassName="sm:max-w-[560px]"
    >
      <div className="flex items-center gap-3">
        <IconChip id={root.icon} color={root.color} size={40} iconSize={19} />
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="text-[12px] font-semibold text-fp-text-3">
            <ValueOrSkeleton value={view?.countStr} className="h-3 w-24" />
          </span>
          <span className="fp-sensitive text-[20px] font-extrabold tracking-[-0.01em] tabular-nums">
            <ValueOrSkeleton value={view?.totalStr} className="h-5 w-28" />
          </span>
        </div>
      </div>

      <div className="flex-none overflow-hidden rounded-[16px] border border-fp-border bg-fp-surface">
        {view ? (
          <ActivityGroups view={view.list} onRowClick={openRow} />
        ) : (
          <SkeletonRows
            count={4}
            rowClassName="border-b border-fp-border px-4 py-[11px]"
          />
        )}
      </div>

      {deltas ? (
        <ConnectedTxEditor
          editor={editor}
          wallets={editorWallets}
          archivedWalletIds={archivedWalletIds}
          goals={goals}
          base={base}
          data={inputs}
          deltas={deltas}
        />
      ) : null}
    </ResponsiveDialog>
  )
}
