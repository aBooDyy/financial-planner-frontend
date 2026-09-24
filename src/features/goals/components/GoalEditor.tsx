import { AlertTriangle } from 'lucide-react'
import type { LocalBalanceNode } from '#/db/types'
import type { GoalFrequency, GoalKind } from '#/features/goals/api/types'
import {
  FREQUENCY_OPTIONS,
  FREQUENCIES,
  GOAL_COLORS,
  KINDS,
  KIND_OPTIONS,
} from '#/features/goals/constants'
import {
  daysUntil,
  relUntil,
  startOfToday,
} from '#/features/goals/data/planning'
import type { GoalCard } from '#/features/goals/data/selectors'
import type {
  EditorDraft,
  EditorState,
} from '#/features/goals/hooks/useGoalEditor'
import { amountInputProps } from '#/lib/currency'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { usePreferencesStore } from '#/stores/preferences'
import { DepositWalletField } from './DepositWalletField'
import { DetailPanel } from './DetailPanel'
import { GoalSchedule } from './GoalSchedule'
import { IncomePaydayField } from './IncomePaydayField'
import { PayOnDueField } from './PayOnDueField'
import { PriorityControl } from './PriorityControl'
import { SetAsideDayField } from './SetAsideDayField'
import { FIELD_LABEL, FIELD_LABEL_TEXT } from './styles'

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
  onDelete: () => void
  onClose: () => void
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
  const kind = draft.kind
  const isRecurring = kind === 'recurring' || kind === 'sinking'
  const today = startOfToday()
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  // Monthly and weekly bills are paid straight from the month's income, never saved toward.
  const hasSetAsides =
    isGoal &&
    !(
      kind === 'recurring' &&
      (draft.frequency === 'monthly' || draft.frequency === 'weekly')
    )

  // Due/target date: a readout in the user's date format (the native picker can't honor it),
  // plus a flag when the date sits in the past.
  const hasDueDate = isGoal && kind !== 'openended'
  const isPastDue =
    hasDueDate && !!draft.dueISO && daysUntil(draft.dueISO, today) < 0
  const dueErrorLabel =
    kind === 'onetime'
      ? 'Target date is in the past'
      : 'Next due date is in the past'

  const titleNoun = !isGoal
    ? 'income'
    : kind === 'onetime'
      ? 'goal'
      : KINDS[kind].chip.toLowerCase()
  const title = id
    ? draft.name.trim() || (isGoal ? 'Untitled' : 'Income')
    : `New ${titleNoun}`
  const subtitle = !id
    ? isGoal
      ? 'Fill in the details'
      : 'Add a stream'
    : !isGoal
      ? 'Income stream'
      : card
        ? `${card.kindLabel} · ${card.statusLabel}`
        : `${KINDS[kind].chip} · completed`

  const amountLabel = !isGoal
    ? 'Amount'
    : kind === 'onetime'
      ? 'Target amount'
      : kind === 'openended'
        ? 'Monthly contribution'
        : 'Amount each time'

  return (
    <DetailPanel
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          {id ? (
            <Button
              variant="outline"
              onClick={onDelete}
              className="text-fp-danger hover:border-fp-danger hover:text-fp-danger"
            >
              Delete
            </Button>
          ) : null}
          <div className="flex-1" />
          <Button onClick={onSave}>
            {id ? 'Save' : isGoal ? 'Add' : 'Add income'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[13px]">
        {isGoal && !id ? (
          <div>
            <Label className={FIELD_LABEL}>Type</Label>
            <div className="grid grid-cols-2 gap-[7px]">
              {KIND_OPTIONS.map((key) => {
                const selected = kind === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onKind(key)}
                    title={KINDS[key].desc}
                    className="rounded-[10px] border px-[6px] py-[9px] text-[12px] font-bold whitespace-nowrap"
                    style={{
                      borderColor: selected
                        ? 'var(--fp-accent)'
                        : 'var(--fp-border-strong)',
                      background: selected
                        ? 'var(--fp-accent-soft)'
                        : 'var(--fp-surface-2)',
                      color: selected
                        ? 'var(--fp-accent-ink)'
                        : 'var(--fp-text)',
                    }}
                  >
                    {KINDS[key].title}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div>
          <Label className={FIELD_LABEL}>{isGoal ? 'Name' : 'Source'}</Label>
          <Input
            value={draft.name}
            onChange={(e) => onField('name', e.target.value)}
            placeholder={
              isGoal
                ? 'e.g. New car, Rent, Emergency fund'
                : 'e.g. Salary, Freelance'
            }
          />
        </div>

        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Label className={FIELD_LABEL}>{amountLabel}</Label>
            <Input
              value={draft.amount}
              onChange={(e) => onField('amount', e.target.value)}
              {...amountInputProps(draft.currency)}
              className="tabular-nums"
            />
          </div>
          <div className="w-[96px] flex-none">
            <Label className={FIELD_LABEL}>Currency</Label>
            <CurrencyPicker
              value={draft.currency}
              onChange={(code) => onField('currency', code)}
              align="end"
            />
          </div>
        </div>

        {(!isGoal || isRecurring) && (
          <div>
            <Label className={FIELD_LABEL}>How often</Label>
            <Select
              value={draft.frequency}
              onValueChange={(v) => onField('frequency', v as GoalFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQUENCIES[f].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!isGoal ? (
          <IncomePaydayField
            draft={draft}
            today={today}
            dateFormat={dateFormat}
            onDay={(day) => onField('day', day)}
            onNextPayday={(iso) => {
              onField('anchorISO', iso)
              onField('day', String(Number(iso.slice(8, 10))))
            }}
          />
        ) : null}

        {!isGoal ? (
          <DepositWalletField
            value={draft.walletId}
            nodes={nodes}
            onChange={(v) => onField('walletId', v)}
          />
        ) : null}

        {hasDueDate ? (
          <div>
            <div className="mb-[6px] flex items-center justify-between gap-2">
              <label className={FIELD_LABEL_TEXT}>
                {kind === 'onetime' ? 'Target date' : 'Next due date'}
              </label>
              <span
                className={`text-[11.5px] font-bold whitespace-nowrap ${
                  isPastDue ? 'text-fp-danger' : 'text-fp-text-2'
                }`}
              >
                {draft.dueISO ? relUntil(draft.dueISO, today) : ''}
              </span>
            </div>
            <DateField
              value={draft.dueISO}
              onChange={(iso) => onField('dueISO', iso)}
              dateFormat={dateFormat}
              invalid={isPastDue}
              ariaLabel={kind === 'onetime' ? 'Target date' : 'Next due date'}
            />
            {isPastDue ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-fp-danger">
                <AlertTriangle
                  size={13}
                  strokeWidth={2.2}
                  className="shrink-0"
                />
                {dueErrorLabel}
              </div>
            ) : null}
          </div>
        ) : null}

        {kind === 'onetime' && isGoal ? (
          <PayOnDueField
            checked={draft.payOnDue}
            onChange={(v) => onField('payOnDue', v)}
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

        <div>
          <Label className={FIELD_LABEL}>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {GOAL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onField('color', color)}
                aria-label={`Colour ${color}`}
                className="h-[26px] w-[26px] rounded-[8px] ring-1 ring-black/10"
                style={{
                  background: color,
                  outline:
                    draft.color === color
                      ? '2px solid var(--fp-text)'
                      : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {card?.hasSchedule ? <GoalSchedule card={card} /> : null}
      </div>
    </DetailPanel>
  )
}
