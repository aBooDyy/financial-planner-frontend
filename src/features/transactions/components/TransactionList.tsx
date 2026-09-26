import { Plus, ReceiptText } from 'lucide-react'
import type { SyncFailure } from '#/db/types'
import type {
  ActivityListView,
  ActivityRow,
  TxRow,
} from '#/features/transactions/data/selectors'
import { TX_TAG_LABEL } from '#/features/transactions/data/selectors'
import { LEDGER_SYNC_ENTITIES } from '#/features/transactions/data/syncFailures'
import { useFailedSyncIds } from '#/hooks/useSyncFailures'
import { EmptyState } from '#/components/EmptyState'
import { TagPill } from '#/components/TagPill'
import { ValueOrSkeleton } from '#/components/ValueOrSkeleton'
import { Button } from '#/components/ui/button'
import { AdjustmentActivityRow } from './AdjustmentActivityRow'
import { CategoryIcon } from './CategoryIcon'
import { RowSyncBadge } from './RowSyncBadge'
import { SetAsideActivityRow } from './SetAsideActivityRow'
import { SkeletonRows } from './SkeletonRows'
import { TransferActivityRow } from './TransferActivityRow'

type Props = {
  /** `null` while the period's rows load; the header and Add render regardless. */
  view: ActivityListView | null
  onAdd: () => void
  onRowClick: (row: ActivityRow) => void
}

function Row({
  row,
  failure,
  onClick,
}: {
  row: TxRow
  failure?: SyncFailure
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 border-b border-fp-border px-4 py-[11px] hover:bg-fp-surface-2"
    >
      <div
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px]"
        style={{ background: `${row.color}22`, color: row.color }}
      >
        <CategoryIcon categoryId={row.categoryId} size={19} />
      </div>
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-[14px] font-semibold">{row.name}</span>
        <span className="flex items-center gap-[6px] text-[12px] text-fp-text-3">
          {row.tag ? (
            <TagPill
              label={TX_TAG_LABEL[row.tag]}
              tone={row.tag === 'obligation' ? 'neutral' : 'accent'}
            />
          ) : null}
          <span className="min-w-0 truncate">{row.catLabel}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-fp-border-strong" />
          <span
            className="h-[7px] w-[7px] rounded-[2px]"
            style={{ background: row.walletColor }}
          />
          {row.walletName}
        </span>
      </div>
      <div className="flex-1" />
      {failure ? (
        <RowSyncBadge row={row} failure={failure} onEdit={onClick} />
      ) : null}
      <span
        className="whitespace-nowrap text-[14.5px] font-bold tabular-nums"
        style={{ color: row.isIncome ? 'var(--fp-accent)' : 'var(--fp-text)' }}
      >
        {row.amountStr}
      </span>
    </div>
  )
}

export function TransactionList({ view, onAdd, onRowClick }: Props) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex items-center justify-between gap-[10px] border-b border-fp-border px-4 py-[15px]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold">Transactions</span>
          <span className="text-[12px] text-fp-text-3">
            <ValueOrSkeleton value={view?.countStr} className="h-3 w-20" />
          </span>
        </div>
        <Button
          type="button"
          onClick={onAdd}
          className="gap-[5px] rounded-[11px] px-[13px] py-[9px] text-[13px] text-white [&_svg]:size-[15px]"
        >
          <Plus size={15} strokeWidth={2.2} />
          Add
        </Button>
      </div>
      {view ? (
        <ActivityGroups view={view} onRowClick={onRowClick} />
      ) : (
        <SkeletonRows
          count={5}
          rowClassName="border-b border-fp-border px-4 py-[11px]"
        />
      )}
    </div>
  )
}

function ActivityGroups({
  view,
  onRowClick,
}: {
  view: ActivityListView
  onRowClick: (row: ActivityRow) => void
}) {
  const failures = useFailedSyncIds(LEDGER_SYNC_ENTITIES)
  return (
    <div>
      {view.groups.map((g) => (
        <div key={g.dateLabel}>
          <div className="flex items-baseline justify-between gap-2 bg-fp-surface-2 px-4 pb-[6px] pt-[11px]">
            <span className="text-[12px] font-bold text-fp-text-2">
              {g.dateLabel}
            </span>
            <span className="text-[12px] tabular-nums text-fp-text-3">
              {g.totalStr}
            </span>
          </div>
          {g.rows.map((r) =>
            r.kind === 'transfer' ? (
              <TransferActivityRow
                key={r.id}
                row={r}
                failure={failures.get(r.id)}
                onClick={() => onRowClick(r)}
              />
            ) : r.kind === 'set_aside' ? (
              <SetAsideActivityRow
                key={r.id}
                row={r}
                onClick={() => onRowClick(r)}
              />
            ) : r.kind === 'adjustment' ? (
              <AdjustmentActivityRow
                key={r.id}
                row={r}
                failure={failures.get(r.id)}
                onClick={() => onRowClick(r)}
              />
            ) : (
              <Row
                key={r.id}
                row={r}
                failure={failures.get(r.id)}
                onClick={() => onRowClick(r)}
              />
            ),
          )}
        </div>
      ))}
      {view.empty ? (
        <EmptyState
          icon={ReceiptText}
          title={view.emptyTitle}
          text={view.emptyText}
        />
      ) : null}
    </div>
  )
}
