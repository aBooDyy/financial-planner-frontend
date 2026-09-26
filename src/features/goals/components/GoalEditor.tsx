import { useState } from 'react'
import type { LocalBalanceNode } from '#/db/types'
import { DialogActions } from '#/components/dialog/DialogActions'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import type { GoalKind } from '#/features/goals/api/types'
import { KINDS } from '#/features/goals/constants'
import type { GoalCard } from '#/features/goals/data/selectors'
import {
  goalSaveBlocker,
  isEditorDirty,
} from '#/features/goals/hooks/useGoalEditor'
import type {
  EditorDraft,
  EditorState,
} from '#/features/goals/hooks/useGoalEditor'
import { DeleteGoalConfirm } from './DeleteGoalConfirm'
import { DetailPanel } from './DetailPanel'
import { GoalFields } from './GoalFields'
import { IncomeFields } from './IncomeFields'

type Props = {
  editing: EditorState
  // The edited goal's place in the active plan; null for income, new goals and completed goals.
  card: GoalCard | null
  rankTotal: number
  onMoveUp: () => void
  onMoveDown: () => void
  nodes: LocalBalanceNode[]
  onField: <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) => void
  onKind: (kind: GoalKind) => void
  onSave: () => void
  onDelete: () => Promise<void>
  onClose: () => void
}

const NEW_NOUN: Record<GoalKind, string> = {
  onetime: 'goal',
  recurring: 'obligation',
  openended: 'fund',
  sinking: 'sinking fund',
}

export function GoalEditor({
  editing,
  card,
  rankTotal,
  onMoveUp,
  onMoveDown,
  nodes,
  onField,
  onKind,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const { type, id, draft } = editing
  const isGoal = type === 'goal'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { requestClose, prompt } = useDiscardGuard({
    dirty: isEditorDirty(editing),
    close: onClose,
  })

  const blocker = isGoal ? goalSaveBlocker(draft) : null
  const fallbackName = isGoal ? 'Untitled' : 'Income'
  const title = id
    ? draft.name.trim() || fallbackName
    : `New ${isGoal ? NEW_NOUN[draft.kind] : 'income'}`
  const subtitle = !id
    ? isGoal
      ? 'Fill in the details'
      : 'Add a stream'
    : !isGoal
      ? 'Income stream'
      : card
        ? `${card.kindLabel} · ${card.statusLabel}`
        : `${KINDS[draft.kind].chip} · completed`

  return (
    <DetailPanel
      title={title}
      subtitle={subtitle}
      onClose={requestClose}
      footer={
        <DialogActions
          hint={blocker}
          ready={blocker === null}
          onDelete={id ? () => setConfirmDelete(true) : undefined}
          onCancel={requestClose}
          submitLabel={id ? 'Save' : isGoal ? 'Add' : 'Add income'}
          onSubmit={() => {
            if (blocker === null) onSave()
          }}
        />
      }
    >
      {isGoal ? (
        <GoalFields
          isNew={!id}
          draft={draft}
          card={card}
          rankTotal={rankTotal}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onField={onField}
          onKind={onKind}
        />
      ) : (
        <IncomeFields draft={draft} nodes={nodes} onField={onField} />
      )}

      {prompt}
      <DeleteGoalConfirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        type={type}
        name={draft.name.trim() || fallbackName}
        onConfirm={onDelete}
      />
    </DetailPanel>
  )
}
