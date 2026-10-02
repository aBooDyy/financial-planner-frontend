import { useMemo } from 'react'
import { usePlannedData } from '#/features/planned/hooks/usePlannedData'
import { usePlanningUi } from '#/features/planning/stores/planningUi'
import { emergencyFundPreset } from '#/features/planning/view/emergencyFund'
import { PlanChooser } from './chooser/PlanChooser'
import { BillEditor } from './editors/BillEditor'
import { GoalEditor } from './editors/GoalEditor'
import { IncomeEditor } from './editors/IncomeEditor'
import { DeleteItemConfirm } from './sheets/DeleteItemConfirm'

/** The one sheet the Planning page has open, by kind. */
export function PlanningSheets() {
  const sheet = usePlanningUi((s) => s.sheet)
  const detail = usePlanningUi((s) => s.detail)
  const openSheet = usePlanningUi((s) => s.openSheet)
  const closeSheet = usePlanningUi((s) => s.closeSheet)
  const closeDetail = usePlanningUi((s) => s.closeDetail)
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
    case 'bill':
      return (
        <BillEditor
          key={sheet.id ?? 'new'}
          id={sheet.id}
          onClose={closeSheet}
          onDelete={(id) =>
            openSheet({ kind: 'delete', target: { kind: 'bill', id } })
          }
        />
      )
    case 'goal':
      return (
        <GoalEditor
          key={sheet.id ?? 'new'}
          id={sheet.id}
          preset={sheet.preset}
          onClose={closeSheet}
          onDelete={(id) =>
            openSheet({ kind: 'delete', target: { kind: 'goal', id } })
          }
        />
      )
    case 'income':
      return (
        <IncomeEditor
          key={sheet.id ?? 'new'}
          id={sheet.id}
          onClose={closeSheet}
          onDelete={(id) =>
            openSheet({ kind: 'delete', target: { kind: 'income', id } })
          }
        />
      )
    case 'delete':
      return (
        <DeleteItemConfirm
          target={sheet.target}
          onClose={closeSheet}
          onDeleted={() => {
            if (detail?.id === sheet.target.id) closeDetail()
          }}
        />
      )
    default:
      return null
  }
}
