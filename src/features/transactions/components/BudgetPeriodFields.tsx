import { Chip, ChipRow } from '#/components/dialog/Chip'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import type { BudgetPeriod } from '#/features/transactions/api/types'
import { BUDGET_PERIODS } from '#/features/transactions/data/scheduleEditor'
import { TxSection } from './TxSection'

type Props = {
  period: BudgetPeriod
  customDays: string
  daysInvalid: boolean
  /** Under the chips while Per paycheck is chosen: its window, or why it is monthly. */
  paycheckHint: string | null
  onPeriod: (period: BudgetPeriod) => void
  onCustomDays: (days: string) => void
}

const TINT = 'var(--fp-spend)'

/** How often a budget resets, and the length of a custom period. */
export function BudgetPeriodFields({
  period,
  customDays,
  daysInvalid,
  paycheckHint,
  onPeriod,
  onCustomDays,
}: Props) {
  return (
    <>
      <TxSection label="How often does it reset?">
        <ChipRow label="Period">
          {BUDGET_PERIODS.map((p) => (
            <Chip
              key={p.value}
              active={period === p.value}
              color={TINT}
              onClick={() => onPeriod(p.value)}
            >
              {p.label}
            </Chip>
          ))}
        </ChipRow>
        {period === 'paycheck' && paycheckHint ? (
          <p className="mt-2 text-[12px] font-semibold text-fp-text-3">
            {paycheckHint}
          </p>
        ) : null}
      </TxSection>

      {period === 'custom' ? (
        <div>
          <FieldLabel htmlFor="budget-days">Period length</FieldLabel>
          <div className="flex items-center gap-[10px]">
            <Input
              id="budget-days"
              value={customDays}
              onChange={(e) => onCustomDays(e.target.value)}
              inputMode="numeric"
              placeholder="30"
              aria-invalid={daysInvalid || undefined}
              className="w-[72px] text-center tabular-nums"
            />
            <span className="text-[13px] font-semibold text-fp-text-2">
              days
            </span>
          </div>
          <FieldMessage
            error={daysInvalid ? 'Enter at least 1 day.' : null}
            help="At least 1 day."
          />
        </div>
      ) : null}
    </>
  )
}
