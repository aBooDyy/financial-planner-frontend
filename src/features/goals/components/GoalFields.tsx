import { OptionTiles } from '#/components/dialog/OptionTiles'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import { TextField } from '#/components/TextField'
import type { GoalKind } from '#/features/goals/api/types'
import { KINDS, KIND_OPTIONS } from '#/features/goals/constants'
import { cycleMonthsOf } from '#/features/goals/data/cadence'
import type { GoalCard } from '#/features/goals/data/selectors'
import { draftFrequencyMeta } from '#/features/goals/hooks/useGoalEditor'
import type { EditorDraft } from '#/features/goals/hooks/useGoalEditor'
import { ColourField } from './ColourField'
import { CustomIntervalField } from './CustomIntervalField'
import { DueDateField } from './DueDateField'
import { EditorAmount } from './EditorAmount'
import { FrequencyChips } from './FrequencyChips'
import { GoalSchedule } from './GoalSchedule'
import { PriorityControl } from './PriorityControl'
import { SetAsideDayField } from './SetAsideDayField'

type Props = {
  isNew: boolean
  draft: EditorDraft
  // The edited goal's place in the active plan; null for new and completed goals.
  card: GoalCard | null
  rankTotal: number
  onMoveUp: () => void
  onMoveDown: () => void
  onField: <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) => void
  onKind: (kind: GoalKind) => void
}

const KIND_TILES = KIND_OPTIONS.map((k) => ({
  value: k,
  label: KINDS[k].title,
  description: KINDS[k].desc,
}))

const AMOUNT_QUESTION: Record<GoalKind, string> = {
  onetime: 'How much do you need?',
  openended: 'How much each month?',
  recurring: 'Amount each time',
  sinking: 'Amount each time',
}

/** The goal editor's body, in the order a person thinks about a goal. */
export function GoalFields({
  isNew,
  draft,
  card,
  rankTotal,
  onMoveUp,
  onMoveDown,
  onField,
  onKind,
}: Props) {
  const kind = draft.kind
  const isRecurring = kind === 'recurring' || kind === 'sinking'
  // Bills due monthly or more often are paid straight from the month's income, never saved
  // toward.
  const hasSetAsides = !(
    kind === 'recurring' && cycleMonthsOf(draftFrequencyMeta(draft)) <= 1
  )

  return (
    <>
      {isNew ? (
        <div>
          <FieldLabel>What kind?</FieldLabel>
          <OptionTiles
            label="What kind?"
            options={KIND_TILES}
            value={kind}
            onChange={onKind}
          />
        </div>
      ) : null}

      <TextField
        id="goal-name"
        label={isNew ? 'What’s it called?' : 'Name'}
        optional={isNew}
        value={draft.name}
        onChange={(e) => onField('name', e.target.value)}
        placeholder="e.g. New car, Rent, Emergency fund"
      />

      <EditorAmount
        question={AMOUNT_QUESTION[kind]}
        amount={draft.amount}
        currency={draft.currency}
        onAmount={(v) => onField('amount', v)}
        onCurrency={(code) => onField('currency', code)}
      />

      {isRecurring ? (
        <div className="flex flex-col gap-3">
          <FrequencyChips
            value={draft.frequency}
            onChange={(f) => {
              onField('frequency', f)
              onField('customRepeat', false)
            }}
            custom={{
              active: draft.customRepeat,
              onSelect: () => onField('customRepeat', true),
            }}
          />
          {draft.customRepeat ? (
            <CustomIntervalField
              interval={draft.customInterval}
              unit={draft.customUnit}
              onInterval={(v) => onField('customInterval', v)}
              onUnit={(u) => onField('customUnit', u)}
            />
          ) : null}
        </div>
      ) : null}

      {kind !== 'openended' ? (
        <DueDateField
          kind={kind}
          value={draft.dueISO}
          onChange={(iso) => onField('dueISO', iso)}
        />
      ) : null}

      {kind === 'onetime' ? (
        <ToggleCard
          title="Pay on the due date"
          description="Also plans the payment itself, so it shows up to confirm when it’s due."
          checked={draft.payOnDue}
          onCheckedChange={(v) => onField('payOnDue', v)}
        />
      ) : null}

      {hasSetAsides ? (
        <SetAsideDayField
          value={draft.setAsideDay}
          onChange={(v) => onField('setAsideDay', v)}
        />
      ) : null}

      {card ? (
        <PriorityControl
          rank={card.rank}
          total={rankTotal}
          canUp={card.canUp}
          canDown={card.canDown}
          onUp={onMoveUp}
          onDown={onMoveDown}
        />
      ) : null}

      {card?.hasSchedule ? <GoalSchedule card={card} /> : null}

      <ColourField value={draft.color} onChange={(c) => onField('color', c)} />
    </>
  )
}
