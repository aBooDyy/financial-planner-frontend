import type { ReactNode } from 'react'
import { CountBadge } from '#/features/planning/components/kit/CountBadge'
import {
  CardHeader,
  PlanCard,
} from '#/features/planning/components/kit/PlanCard'
import { Spine } from '#/features/planning/components/kit/Spine'

export type DecisionRow = {
  key: string
  name: string
  color: string
  note: string
  actions: ReadonlyArray<{
    label: string
    title?: string
    onClick: () => void
  }>
}

/** Needs a decision (04 §5): bills and goals the plan can't cover in time, with what to do. */
export function DecisionsCard({ rows }: { rows: ReadonlyArray<DecisionRow> }) {
  if (rows.length === 0) return null
  return (
    <PlanCard>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Needs a decision
            <CountBadge
              count={rows.length}
              tone="danger"
              label={`${rows.length} need a decision`}
            />
          </span>
        }
      />
      <ul>
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex flex-wrap items-stretch gap-3 border-t border-fp-border px-[18px] py-3"
          >
            <Spine color={r.color} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">{r.name}</p>
              <p className="fp-sensitive text-[12px] text-fp-text-2">
                {r.note}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {r.actions.map(
                (a): ReactNode => (
                  <button
                    key={a.label}
                    type="button"
                    title={a.title}
                    onClick={a.onClick}
                    className="rounded-[10px] border border-fp-border-strong bg-fp-surface px-3 py-[7px] text-[12.5px] font-bold hover:bg-fp-surface-2"
                  >
                    {a.label}
                  </button>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </PlanCard>
  )
}
