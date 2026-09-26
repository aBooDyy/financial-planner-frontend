import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import type { CompletedGoal, GoalList } from '#/features/goals/data/selectors'
import { CompletedGoalRow } from './CompletedGoalRow'
import { GoalGroupCard } from './GoalGroupCard'
import { GoalRow } from './GoalRow'
import { SectionHeader } from './SectionHeader'

type Props = {
  title: string
  list: GoalList
  completed: CompletedGoal[]
  addLabel: string
  empty: { icon: LucideIcon; title: string; text: string }
  selectedId: string | null
  dueByGoal: Record<string, number>
  onAdd: () => void
  onSelect: (id: string) => void
}

export function GoalListSection({
  title,
  list,
  completed,
  addLabel,
  empty,
  selectedId,
  dueByGoal,
  onAdd,
  onSelect,
}: Props) {
  const isEmpty = list.count === 0 && completed.length === 0

  return (
    <div className="flex flex-col gap-[14px]">
      <SectionHeader
        title={title}
        sub={list.subStr}
        actionLabel={addLabel}
        onAction={onAdd}
      />

      {isEmpty ? (
        <EmptyState
          {...empty}
          framed
          action={{ label: addLabel, onClick: onAdd }}
        />
      ) : null}

      {list.groups.map((group) => (
        <GoalGroupCard
          key={group.status}
          title={group.title}
          note={group.note}
          tone={group.status}
        >
          {group.rows.map((card) => (
            <GoalRow
              key={card.id}
              card={card}
              selected={card.id === selectedId}
              dueCount={dueByGoal[card.id] ?? 0}
              onSelect={onSelect}
            />
          ))}
        </GoalGroupCard>
      ))}

      {completed.length > 0 ? (
        <GoalGroupCard
          title={`Completed · ${completed.length}`}
          note="fully saved"
        >
          {completed.map((goal) => (
            <CompletedGoalRow
              key={goal.id}
              goal={goal}
              selected={goal.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </GoalGroupCard>
      ) : null}
    </div>
  )
}
