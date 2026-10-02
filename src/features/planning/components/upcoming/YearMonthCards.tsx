import type { LocalBill, LocalGoal } from '#/db/types'
import type { YearAhead } from '#/features/planning/data/yearAhead'
import type { CurrencyCode } from '#/lib/currency'
import { money } from '#/features/planning/view/format'
import { monthHead, monthLines } from '#/features/planning/view/yearView'
import { Dot } from '#/features/planning/components/kit/Spine'

type Props = {
  ahead: YearAhead
  bills: ReadonlyArray<LocalBill>
  goals: ReadonlyArray<LocalGoal>
  base: CurrencyCode
  onOpen: (kind: 'bill' | 'goal', id: string) => void
}

/** Year ahead as month cards (mobile, D22): what each month brings in, owes and sets aside. */
export function YearMonthCards({ ahead, bills, goals, base, onOpen }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
      {ahead.months.map((m, i) => {
        const head = monthHead(ahead.months, i)
        const lines = monthLines(m, bills, goals, base).filter(
          (l) => !l.setAside,
        )
        return (
          <section
            key={m.month}
            aria-label={head.year ? `${head.name} ${head.year}` : head.name}
            className="rounded-[16px] border border-fp-border bg-fp-surface p-4 shadow-fp"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-extrabold">
                {head.name}
                {head.year ? (
                  <span className="ms-1 text-fp-text-3">{head.year}</span>
                ) : null}
              </h3>
              {m.income > 0 ? (
                <span className="fp-sensitive text-[12.5px] font-bold text-fp-accent-ink">
                  +{money(m.income, base)}
                </span>
              ) : null}
            </div>
            <ul className="mt-2 flex flex-col gap-[6px]">
              {lines.map((l) => (
                <li key={l.key}>
                  <button
                    type="button"
                    disabled={!l.ownerId}
                    onClick={() => {
                      if (l.ownerId && l.kind !== 'monthly')
                        onOpen(l.kind, l.ownerId)
                    }}
                    className="flex w-full items-center gap-2 text-start text-[13px]"
                  >
                    <Dot color={l.color} />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {l.name}
                    </span>
                    <span className="text-[11.5px] text-fp-text-3">
                      {l.note}
                    </span>
                    <span className="fp-sensitive font-bold tabular-nums">
                      {l.amount}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-2 border-t border-fp-border pt-2 text-[12px]">
              <span className="font-semibold text-fp-text-2">Set aside</span>
              <span className="flex h-[7px] flex-1 gap-px overflow-hidden rounded-full bg-fp-surface-2">
                {m.setAside.byOwner.map((o) => (
                  <span
                    key={`${o.kind}${o.ownerId}`}
                    style={{
                      flexGrow: o.amount,
                      background: o.color || 'var(--fp-chart-set-aside)',
                    }}
                  />
                ))}
              </span>
              <span className="fp-sensitive font-extrabold text-fp-transfer tabular-nums">
                {money(m.setAside.total, base)}
              </span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
