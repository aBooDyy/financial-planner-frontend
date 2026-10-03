import { useMemo } from 'react'
import { Target } from 'lucide-react'
import type { LocalGoal } from '#/db/types'
import { updateGoal } from '#/features/goals/data/mutations'
import { goalOwner } from '#/features/planned/data/owners'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { GoalStatus } from '#/features/planning/data/status'
import { useItemActions } from '#/features/planning/hooks/useItemActions'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { emergencyFundPreset } from '#/features/planning/view/emergencyFund'
import {
  money,
  monthYear,
  perPeriod,
  plural,
} from '#/features/planning/view/format'
import { goalChip, goalMeta } from '#/features/planning/view/itemCopy'
import type { RankChange, TierKey } from '#/features/planning/view/reorder'
import { convertMinor } from '#/lib/currency'
import { ProgressBar } from '#/features/planning/components/kit/ProgressBar'
import { DoneCard } from './DoneCard'
import { EmptyPlanCard } from './EmptyPlanCard'
import { ItemRow } from './ItemRow'
import { SectionHeading } from './SectionHeading'
import { TierCard } from './TierCard'
import { useTierDrag } from './useTierDrag'
import { useIsDesktop } from '#/hooks/useMediaQuery'

const TIER_TITLE: Record<TierKey, string> = {
  must: 'Must have',
  nice: 'Nice to have',
}

async function applyGoalRanks(changes: RankChange[]) {
  for (const c of changes)
    await updateGoal(c.id, {
      position: c.position,
      mustHave: c.tier === 'must',
    })
}

/** Goals (04 §5): Must have and Nice to have tiers, drag to reorder, finished ones in Reached. */
export function GoalsSection() {
  const planning = usePlanning()
  const { inputs } = usePlannedData()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const openDetail = usePlanningUi((s) => s.openDetail)
  const actions = useItemActions()
  // Touch screens can't drag rows, so moving is offered in each row's ⋯ menu instead.
  const desktop = useIsDesktop()
  const { calendar } = planning
  const base = inputs.base
  const suggestion = useMemo(
    () => emergencyFundPreset(inputs.goals, inputs.bills, base, inputs.rates),
    [inputs.goals, inputs.bills, base, inputs.rates],
  )

  const statusOf = (g: LocalGoal) =>
    planning.goals[g.id] as GoalStatus | undefined
  const open = inputs.goals
    .filter((g) => g.closedAt === null)
    .sort((a, b) => a.position - b.position)
  const tiers: Record<TierKey, LocalGoal[]> = {
    must: open.filter((g) => g.mustHave),
    nice: open.filter((g) => !g.mustHave),
  }
  const drag = useTierDrag(tiers, applyGoalRanks)
  const done = inputs.goals.filter((g) => g.closedAt !== null)

  const add = () => openSheet({ kind: 'goal', id: null })
  if (planning.loading) return null
  const doneCard = (
    <DoneCard
      title="Reached"
      items={done.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        note: [
          `${money(statusOf(g)?.progress ?? 0, g.currency)} saved`,
          g.closedAt ? monthYear(g.closedAt.slice(0, 10)) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        onReopen: () => void actions.reopen(g, 'goal'),
        onOpen: () => openDetail(goalOwner(g.id)),
      }))}
    />
  )
  if (open.length === 0)
    return (
      <>
        <SectionHeading title="Goals" addLabel="Add goal" onAdd={add} />
        <EmptyPlanCard
          icon={Target}
          title="No goals yet"
          text="Save for a trip, a car, or a rainy day — set a target and a date, or just a monthly amount."
          addLabel="Add goal"
          onAdd={add}
          extra={
            suggestion ? (
              <button
                type="button"
                onClick={() =>
                  openSheet({ kind: 'goal', id: null, preset: suggestion })
                }
                className="flex items-center gap-2 rounded-full border-[1.5px] border-fp-border px-[13px] py-2 text-[13px] font-bold text-fp-text hover:border-fp-accent"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-fp-accent"
                />
                Emergency fund
                {suggestion.target
                  ? ` · ${money(suggestion.target, base)}`
                  : ''}
              </button>
            ) : null
          }
        />
        {doneCard}
      </>
    )

  const toBase = (amount: number, currency: string) =>
    convertMinor(amount, currency, base, inputs.rates)
  const paceOf = (list: LocalGoal[]) =>
    list.reduce(
      (sum, g) => sum + toBase(statusOf(g)?.perPaycheck ?? 0, g.currency),
      0,
    )
  const total = paceOf(open)

  return (
    <>
      <SectionHeading
        title="Goals"
        count={open.length}
        sub={
          total > 0
            ? `${money(total, base)} ${perPeriod(calendar)} toward ${plural(open.length, 'goal')} · drag between groups to change priority`
            : undefined
        }
        addLabel="Add goal"
        onAdd={add}
      />
      {(['must', 'nice'] as const).map((tier) =>
        tiers[tier].length === 0 ? null : (
          <TierCard
            key={tier}
            title={TIER_TITLE[tier]}
            note={
              paceOf(tiers[tier]) > 0
                ? `${money(paceOf(tiers[tier]), base)} ${perPeriod(calendar)}`
                : undefined
            }
          >
            {tiers[tier].map((g) => {
              const s = statusOf(g)
              if (!s) return null
              const paused = s.state === 'paused'
              return (
                <ItemRow
                  key={g.id}
                  name={g.name}
                  color={g.color}
                  meta={goalMeta(g, s, calendar)}
                  amount={paused ? '—' : money(s.perPaycheck, g.currency)}
                  amountNote={paused ? undefined : perPeriod(calendar)}
                  chip={goalChip(s, g.currency)}
                  muted={paused}
                  progress={
                    s.target > 0 ? (
                      <ProgressBar
                        value={s.progress}
                        max={s.target}
                        color={g.color}
                        label={`${g.name} saved`}
                      />
                    ) : undefined
                  }
                  menu={[
                    ...actions.goalMenu(g),
                    ...(desktop
                      ? []
                      : drag.moveActions(g.id, tier, TIER_TITLE)),
                  ]}
                  onOpen={() => openDetail(goalOwner(g.id))}
                  drag={drag.rowProps(g.id, tier)}
                  onGripKey={drag.gripKeys(g.id, tier)}
                />
              )
            })}
          </TierCard>
        ),
      )}
      {doneCard}
    </>
  )
}
