import { CurrencyPicker } from '#/components/CurrencyPicker'
import { AmountWell } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import { FieldLabel } from '#/components/FieldLabel'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { useEverydayEditor } from '#/features/planning/hooks/useEverydayEditor'
import { usePlanningReady } from '#/features/planning/hooks/usePlanningReady'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { money } from '#/features/planning/view/format'
import { BudgetPeriodFields } from '#/features/transactions/components/BudgetPeriodFields'
import { BudgetTargetSelect } from '#/features/transactions/components/BudgetTargetSelect'
import {
  customDaysValid,
  paycheckHint,
} from '#/features/transactions/data/scheduleEditor'

type Props = {
  /** The budget it edits; null for a new one. */
  id: string | null
  onClose: () => void
}

const NO_WALLETS: never[] = []

/** Everyday spending: a rough amount for spending that varies, like groceries. */
export function EverydayEditor(props: Props) {
  return usePlanningReady() ? <EverydayEditorForm {...props} /> : null
}

function EverydayEditorForm({ id, onClose }: Props) {
  const e = useEverydayEditor(id, onClose)
  const guard = useDiscardGuard({ dirty: e.dirty, close: onClose })
  const { form, set } = e
  const amountMissing = e.showErrors && e.block === 'Enter about how much'

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) guard.requestClose()
        }}
        title={e.budget ? 'Edit everyday spending' : 'Everyday spending'}
        description="Spending that varies, so your plan can leave room for it."
        footer={
          <DialogActions
            hint={e.block}
            onDelete={
              e.removeFromPlan ? () => void e.removeFromPlan?.() : undefined
            }
            deleteLabel="Take out of plan"
            onCancel={guard.requestClose}
            submitLabel={e.budget ? 'Save changes' : 'Add to plan'}
            ready={e.block === null}
            onSubmit={() => void e.save()}
          />
        }
      >
        <div>
          <FieldLabel htmlFor="everyday-category">
            What do you spend it on?
          </FieldLabel>
          <BudgetTargetSelect
            id="everyday-category"
            scope="category"
            value={form.categoryId}
            onChange={e.pickCategory}
            wallets={NO_WALLETS}
          />
        </div>
        <AmountWell
          question="About how much?"
          currency={form.currency}
          amount={form.amount}
          onAmount={(v) => set('amount', v)}
          invalid={amountMissing}
          tone="spend"
        >
          <CurrencyPicker
            value={form.currency}
            onChange={(code) => set('currency', code)}
            appearance="pill"
            prefix="Currency"
            align="center"
          />
        </AmountWell>
        {e.monthly !== null && e.suggestion !== null ? (
          <p className="fp-sensitive flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-semibold text-fp-text-2">
            You’ve spent about {money(e.monthly, form.currency)} a month on this
            lately.
            <button
              type="button"
              onClick={() => set('amount', e.suggestion ?? '')}
              className="font-bold text-fp-accent-ink hover:underline"
            >
              Use {e.suggestion}
            </button>
          </p>
        ) : null}
        <BudgetPeriodFields
          label="How often?"
          period={form.period}
          customDays={form.customDays}
          daysInvalid={
            e.showErrors &&
            form.period === 'custom' &&
            !customDaysValid(form.customDays)
          }
          paycheckHint={paycheckHint(e.calendar, e.today)}
          onPeriod={(p) => set('period', p)}
          onCustomDays={(d) => set('customDays', d)}
        />
        <InfoLine>{e.preview}</InfoLine>
      </ResponsiveDialog>
      {guard.prompt}
    </>
  )
}
