import { Link } from '@tanstack/react-router'
import { ArrowUp, Check } from 'lucide-react'
import type { LocalIncomeStream } from '#/db/types'
import { frequencyMetaOf } from '#/features/goals/data/cadence'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { paydaysOf } from '#/features/goals/data/paydays'
import {
  isStreamActive,
  monthlyIncomeOf,
} from '#/features/planning/data/payPeriods'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningWallets } from '#/features/planning/hooks/usePlanningWallets'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { dayMonth, money, ordinal } from '#/features/planning/view/format'
import { repeatLabel } from '#/features/planning/view/repeat'
import { updatePlanningSettings } from '#/features/wallets/data/mutations'
import { addDaysISO } from '#/features/planned/data/dates'
import { ItemMenu } from '#/features/planning/components/kit/ItemMenu'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'
import { Spine } from '#/features/planning/components/kit/Spine'
import { EmptyPlanCard } from './EmptyPlanCard'
import { LoadingList } from './LoadingList'
import { SectionHeading } from './SectionHeading'
import { PLANNING_PREFS_ID } from '#/features/settings/data/planningPrefs'

/** "Monthly · 25th · into Main bank" / "Weekly · next Oct 9 · into Savings". */
function incomeMeta(
  s: LocalIncomeStream,
  walletName: string | null,
  today: string,
): string {
  const when =
    s.frequency === 'monthly'
      ? ordinal(s.day)
      : (() => {
          const next = paydaysOf(s, today, addDaysISO(today, 400)).at(0)
          return next ? `next ${dayMonth(next)}` : null
        })()
  return [
    repeatLabel(s),
    when,
    walletName ? `into ${walletName}` : null,
    s.endsOn ? `until ${dayMonth(s.endsOn)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Income (04 §5): every stream, the one that sets the pay periods tagged. */
export function IncomeSection() {
  const planning = usePlanning()
  const { inputs, today } = usePlannedData()
  const wallets = usePlanningWallets()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const { calendar } = planning
  const mainId = calendar.kind === 'paycheck' ? calendar.stream.id : null

  const add = () => openSheet({ kind: 'income', id: null })
  if (planning.loading)
    return <LoadingList title="Income" addLabel="Add income" onAdd={add} />
  const streams = [...inputs.income].sort((a, b) => a.position - b.position)
  if (streams.length === 0)
    return (
      <>
        <SectionHeading title="Income" addLabel="Add income" onAdd={add} />
        <EmptyPlanCard
          icon={ArrowUp}
          title="No income yet"
          text="Add your salary and any other money that comes in. Your plan splits each paycheck between bills, goals and spending."
          addLabel="Add income"
          onAdd={add}
        />
      </>
    )

  const active = streams.filter((s) => isStreamActive(s, today))
  const monthly = active.reduce(
    (sum, s) => sum + monthlyIncomeOf(s, inputs.base, inputs.rates),
    0,
  )
  const periods =
    calendar.kind === 'paycheck'
      ? calendar.stream.frequency === 'monthly'
        ? `pay periods run from the ${ordinal(calendar.stream.day)}`
        : `pay periods follow ${calendar.stream.label}`
      : 'pay periods are calendar months'

  return (
    <>
      <SectionHeading
        title="Income"
        sub={`${money(monthly, inputs.base)} a month · ${periods}`}
        subLink={
          <Link
            to="/settings/preferences"
            hash={PLANNING_PREFS_ID}
            className="font-semibold text-fp-text-2 underline decoration-fp-border underline-offset-2 hover:text-fp-text"
          >
            Planning settings
          </Link>
        }
        addLabel="Add income"
        onAdd={add}
      />
      <PlanCard className="overflow-hidden">
        <ul>
          {streams.map((s, i) => {
            const isMain = s.id === mainId
            const walletName = s.walletId
              ? (wallets.byId.get(s.walletId)?.name ?? null)
              : null
            return (
              <li
                key={s.id}
                className={`flex items-stretch gap-3 px-4 py-[13px] ${i > 0 ? 'border-t border-fp-border' : ''} ${isStreamActive(s, today) ? '' : 'opacity-60'}`}
              >
                <Spine color={s.color} />
                <button
                  type="button"
                  onClick={() => openSheet({ kind: 'income', id: s.id })}
                  className="flex min-w-0 flex-1 items-center gap-3 text-start"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-bold">
                        {s.label}
                      </span>
                      {isMain ? (
                        <span className="flex items-center gap-1 rounded-full bg-fp-accent-soft px-2 py-[2px] text-[11px] font-bold text-fp-accent-ink">
                          <Check size={12} strokeWidth={2.6} aria-hidden />
                          Sets my pay periods
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-[3px] block truncate text-[11.5px] text-fp-text-3">
                      {incomeMeta(s, walletName, today)}
                    </span>
                  </span>
                  <span className="fp-sensitive flex-none text-[14px] font-extrabold tabular-nums">
                    {money(s.amount, s.currency)}
                    <span className="ms-[2px] text-[11px] font-semibold text-fp-text-3">
                      {frequencyMetaOf(s, 'monthly').short}
                    </span>
                  </span>
                </button>
                <span className="flex items-center">
                  <ItemMenu
                    label={`More for ${s.label}`}
                    actions={[
                      {
                        label: 'Edit',
                        onSelect: () => openSheet({ kind: 'income', id: s.id }),
                      },
                      ...(isMain
                        ? []
                        : [
                            {
                              label: 'Use for my pay periods',
                              onSelect: () =>
                                void updatePlanningSettings({
                                  mainIncomeStreamId: s.id,
                                }).then(() =>
                                  toast(`${s.label} now sets your pay periods`),
                                ),
                            },
                          ]),
                      {
                        label: 'Delete',
                        destructive: true,
                        onSelect: () =>
                          openSheet({
                            kind: 'delete',
                            target: { kind: 'income', id: s.id },
                          }),
                      },
                    ]}
                  />
                </span>
              </li>
            )
          })}
        </ul>
      </PlanCard>
      <p className="px-1 text-[12.5px] leading-[1.5] text-fp-text-3">
        Your plan splits each paycheck from the income marked &ldquo;Sets my pay
        periods&rdquo;. Other income is added to the same paycheck.
      </p>
    </>
  )
}
