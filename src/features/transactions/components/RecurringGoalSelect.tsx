import { FieldLabel } from '#/components/FieldLabel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { LocalGoal } from '#/db/types'

type Props = {
  goals: ReadonlyArray<LocalGoal>
  value: string | null
  onChange: (goalId: string | null) => void
}

const NONE = '__none__'

/** The goal a recurring spend pays toward, if any. */
export function RecurringGoalSelect({ goals, value, onChange }: Props) {
  return (
    <div>
      <FieldLabel htmlFor="recurring-goal" optional>
        Toward a goal
      </FieldLabel>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
      >
        <SelectTrigger id="recurring-goal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not a contribution</SelectItem>
          {goals.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
