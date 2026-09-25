import { useState } from 'react'
import type { LocalPlanned } from '#/db/types'
import type {
  PlannedListView,
  PlannedRowView,
} from '#/features/planned/data/views'
import { NEXT_DAYS } from '#/features/planned/data/views'
import { PlannedBand } from './PlannedBand'
import { PlannedEmpty } from './PlannedEmpty'
import { PlannedRow } from './PlannedRow'

type MonthGroup = { key: string; label: string; rows: PlannedRowView[] }

/** Later rows by calendar month: "October", "November", … (with the year once it changes). */
function byMonth(rows: ReadonlyArray<PlannedRowView>): MonthGroup[] {
  const groups: MonthGroup[] = []
  const firstYear = rows[0]?.item.date.slice(0, 4)
  for (const r of rows) {
    const key = r.item.date.slice(0, 7)
    const last = groups[groups.length - 1] as MonthGroup | undefined
    if (last?.key === key) {
      last.rows.push(r)
      continue
    }
    const [y, m] = key.split('-').map(Number)
    const label = new Date(y, m - 1, 1).toLocaleString('en-US', {
      month: 'long',
      ...(key.slice(0, 4) === firstYear ? {} : { year: 'numeric' }),
    })
    groups.push({ key, label, rows: [r] })
  }
  return groups
}

type Props = {
  view: PlannedListView
  loading: boolean
  colorOf: (item: LocalPlanned) => string
  busyId: string | null
  onOpen: (id: string) => void
  onConfirm: (row: PlannedRowView) => void
  onSkip: (row: PlannedRowView) => void
}

/**
 * The Planned tab (1c): what needs confirming, the next two weeks, and — collapsed — later.
 * Nothing here is in balances yet; confirming makes it real.
 */
export function PlannedCard({
  view,
  loading,
  colorOf,
  busyId,
  onOpen,
  onConfirm,
  onSkip,
}: Props) {
  const [showLater, setShowLater] = useState(false)

  const muted = (r: PlannedRowView) => (
    <PlannedRow
      key={r.id}
      row={r}
      color={colorOf(r.item)}
      muted
      onOpen={() => onOpen(r.id)}
    />
  )

  return (
    <div className="overflow-hidden rounded-[18px] border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex flex-col border-b border-fp-border px-4 py-[15px]">
        <span className="text-[15px] font-bold">Planned</span>
        <span className="text-[12px] text-fp-text-3">
          Paydays, bills and set-asides — they count once you confirm them
        </span>
      </div>

      {loading ? null : view.isEmpty ? (
        <PlannedEmpty />
      ) : (
        <>
          {view.due.length > 0 ? (
            <section aria-label="Needs confirming">
              <PlannedBand
                tone="due"
                title={`Needs confirming · ${view.dueCount}`}
              />
              {view.due.map((r) => (
                <PlannedRow
                  key={r.id}
                  row={r}
                  color={colorOf(r.item)}
                  busy={busyId === r.id}
                  onOpen={() => onOpen(r.id)}
                  onConfirm={() => onConfirm(r)}
                  // A partly settled item cannot be skipped; its dialog offers "Close the rest".
                  onSkip={r.isPartial ? undefined : () => onSkip(r)}
                />
              ))}
            </section>
          ) : null}

          <section aria-label={`Planned · next ${NEXT_DAYS} days`}>
            <PlannedBand
              title={`Planned · next ${NEXT_DAYS} days`}
              caption={view.next.length > 0 ? view.nextCaption : undefined}
            />
            {view.next.length > 0 ? (
              view.next.map(muted)
            ) : (
              <p className="px-4 py-[14px] text-[12.5px] text-fp-text-3">
                Nothing in the next {NEXT_DAYS} days.
              </p>
            )}
          </section>

          {view.later.length > 0 ? (
            <section aria-label="Later">
              {(showLater
                ? byMonth(view.later)
                : [{ key: 'later', label: '', rows: [] }]
              ).map((g, i) => (
                <div key={g.key}>
                  <PlannedBand
                    title={i === 0 ? view.laterLabel : g.label}
                    caption={
                      i === 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowLater((s) => !s)}
                          className="font-semibold text-fp-accent-ink hover:underline"
                        >
                          {showLater
                            ? 'Show less'
                            : `${view.later.length} more · Show all`}
                        </button>
                      ) : undefined
                    }
                  />
                  {g.rows.map(muted)}
                </div>
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
