import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { emergencyFundPreset } from '#/features/planning/view/emergencyFund'
import { PlanChooser } from './chooser/PlanChooser'

/** The one sheet the Planning page has open, by kind. */
export function PlanningSheets() {
  const sheet = usePlanningUi((s) => s.sheet)
  const openSheet = usePlanningUi((s) => s.openSheet)
  const closeSheet = usePlanningUi((s) => s.closeSheet)
  const { inputs } = usePlannedData()
  const suggestion = useMemo(
    () =>
      emergencyFundPreset(
        inputs.goals,
        inputs.bills,
        inputs.base,
        inputs.rates,
      ),
    [inputs.goals, inputs.bills, inputs.base, inputs.rates],
  )

  if (!sheet) return null
  switch (sheet.kind) {
    case 'chooser':
      return (
        <PlanChooser
          open
          onClose={closeSheet}
          onPick={(kind) => openSheet({ kind, id: null })}
          suggestion={suggestion}
          onSuggestion={(preset) =>
            openSheet({ kind: 'goal', id: null, preset })
          }
        />
      )
    default:
      return null
  }
}
