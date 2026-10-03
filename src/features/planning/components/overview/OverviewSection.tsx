import { useNavigate } from '@tanstack/react-router'
import { updateGoal } from '#/features/goals/data/mutations'
import { billOwner } from '#/features/planned/data/owners'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { Decision } from '#/features/planning/data/paycheck'
import { usePlanning } from '#/features/planning/hooks/usePlanning'
import type { PlanningSection } from '#/features/planning/sections'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { toast } from '#/features/planning/stores/toast'
import { monthYear } from '#/features/planning/view/format'
import {
  decisionNote,
  next30Events,
  paycheckBar,
  verdictCopy,
} from '#/features/planning/view/overview'
import type { VerdictAction } from '#/features/planning/view/overview'
import { DecisionsCard } from './DecisionsCard'
import { LastMonthLine } from './LastMonthLine'
import type { DecisionRow } from './DecisionsCard'
import { Next30Card } from './Next30Card'
import { PaycheckCard } from './PaycheckCard'
import { VerdictCard } from './VerdictCard'

/** Overview (04 §5): the verdict, each paycheck, the next 30 days and what needs a decision. */
export function OverviewSection() {
  const planning = usePlanning()
  const { inputs } = usePlannedData()
  const navigate = useNavigate()
  const openSheet = usePlanningUi((s) => s.openSheet)
  const openDetail = usePlanningUi((s) => s.openDetail)
  const show = (section: PlanningSection) =>
    void navigate({ to: '/planning/$section', params: { section } })
  if (planning.loading)
    return (
      <>
        <VerdictCard copy={null} onAction={() => undefined} />
        <PaycheckCard bar={null} base={inputs.base} onSection={show} />
        <Next30Card
          events={null}
          due={[]}
          today={planning.today}
          onSeeAll={() => show('upcoming')}
          onEvent={() => undefined}
        />
      </>
    )

  const base = inputs.base
  const ownerOf = (d: Decision) =>
    d.kind === 'bill'
      ? inputs.bills.find((b) => b.id === d.ownerId)
      : inputs.goals.find((g) => g.id === d.ownerId)

  const copy = verdictCopy({
    verdict: planning.verdict,
    decision: planning.decisions.at(0) ?? null,
    owner: (d) => {
      const o = ownerOf(d)
      return { name: o?.name ?? 'A goal', currency: o?.currency ?? base }
    },
    base,
    calendar: planning.calendar,
  })
  const act = (to: VerdictAction) => {
    if (to === 'upcoming') show('upcoming')
    else if (to === 'chooser') openSheet({ kind: 'chooser' })
    else if (to === 'income') openSheet({ kind: 'income', id: null })
    else openSheet({ kind: to.kind, id: to.id })
  }

  const verdict = (
    <VerdictCard copy={copy} onAction={() => act(copy.action.to)} />
  )
  if (planning.verdict.kind === 'start' && planning.verdict.reason === 'empty')
    return verdict

  const decisions: DecisionRow[] = planning.decisions.flatMap((d) => {
    const owner = ownerOf(d)
    if (!owner) return []
    const edit = {
      label: 'Adjust',
      onClick: () => openSheet({ kind: d.kind, id: d.ownerId }),
    }
    const pushOut = d.pushOutTo
    return [
      {
        key: `${d.kind}:${d.ownerId}`,
        name: owner.name,
        color: owner.color,
        note: decisionNote(d, owner, planning.calendar),
        actions:
          d.kind === 'goal' && pushOut
            ? [
                {
                  label: 'Push out',
                  title: `Move to ${monthYear(pushOut)}`,
                  onClick: () =>
                    void updateGoal(d.ownerId, { dueDate: pushOut }).then(() =>
                      toast(`${owner.name} moved to ${monthYear(pushOut)}`),
                    ),
                },
                edit,
              ]
            : [edit],
      },
    ]
  })

  return (
    <>
      {verdict}
      <PaycheckCard
        bar={paycheckBar(planning.paycheck, base, planning.calendar)}
        base={base}
        onSection={show}
        footer={<LastMonthLine />}
      />
      <Next30Card
        events={next30Events(planning.upcoming, inputs.bills, planning.today)}
        due={planning.upcoming.due}
        today={planning.today}
        onSeeAll={() => show('upcoming')}
        onEvent={(e) => {
          if (e.billId) {
            show('bills')
            openDetail(billOwner(e.billId))
          } else show('income')
        }}
      />
      <DecisionsCard rows={decisions} />
    </>
  )
}
