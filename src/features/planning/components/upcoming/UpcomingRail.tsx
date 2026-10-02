import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import type { PlanningView } from '#/features/planning/hooks/usePlanning'
import { useMoneyFigures } from '#/features/planning/hooks/useMoneyFigures'
import { balanceAhead } from '#/features/planning/view/ahead'
import { paycheckBar } from '#/features/planning/view/overview'
import { BalanceAheadCard } from './BalanceAheadCard'
import { HeadedCard } from './HeadedCard'

/** Upcoming's side column: Balance ahead and Where it's headed. */
export function UpcomingRail({ planning }: { planning: PlanningView }) {
  const { inputs } = usePlannedData()
  const money = useMoneyFigures()
  const { upcoming, today } = planning
  const view = useMemo(
    () =>
      money.loading
        ? null
        : balanceAhead({
            rows: [...upcoming.due, ...upcoming.periods.flatMap((p) => p.rows)],
            balance: money.figures.header.balance,
            setAside: money.figures.header.setAside,
            base: inputs.base,
            rates: inputs.rates,
            today,
          }),
    [money, upcoming, inputs.base, inputs.rates, today],
  )
  return (
    <div className="flex flex-col gap-4">
      <BalanceAheadCard view={view} base={inputs.base} />
      <HeadedCard
        bar={paycheckBar(planning.paycheck, inputs.base, planning.calendar)}
        base={inputs.base}
      />
    </div>
  )
}
