import { AmountWell } from '#/components/dialog/AmountWell'
import { ColorSwatches } from '#/components/dialog/ColorSwatches'
import { DialogActions } from '#/components/dialog/DialogActions'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { useEditorReady } from '#/features/planning/hooks/useEditorReady'
import { useGoalEditor } from '#/features/planning/hooks/useGoalEditor'
import type { GoalPreset } from '#/features/planning/stores/planningUi'
import { ITEM_COLORS } from '#/features/planning/view/colors'
import { amountInputProps, currencySymbol } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { MoreOptions } from './fields/MoreOptions'
import { WalletPills } from './fields/WalletPills'

type Props = {
  id: string | null
  preset?: GoalPreset
  onClose: () => void
  onDelete: (id: string) => void
}

/** New goal / Edit goal (04 §4): a target and a date, or a monthly amount. */
export function GoalEditor(props: Props) {
  return useEditorReady() ? <GoalEditorForm {...props} /> : null
}

function GoalEditorForm({ id, preset, onClose, onDelete }: Props) {
  const e = useGoalEditor(id, preset, onClose)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const guard = useDiscardGuard({ dirty: e.dirty, close: onClose })
  const { form, set } = e
  const monthlyInput = amountInputProps(e.currency, form.monthly, (v) =>
    set('monthly', v),
  )

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) guard.requestClose()
        }}
        title={e.goal ? `Edit ${e.goal.name}` : 'New goal'}
        description="Something you are saving up for."
        footer={
          <DialogActions
            hint={e.block}
            onDelete={e.goal ? () => onDelete(e.goal?.id ?? '') : undefined}
            onCancel={guard.requestClose}
            submitLabel={e.goal ? 'Save changes' : 'Add goal'}
            ready={e.block === null}
            onSubmit={() => void e.save()}
          />
        }
      >
        <FormRow id="goal-name" label="What are you saving for?">
          <Input
            id="goal-name"
            value={form.name}
            onChange={(ev) => set('name', ev.target.value)}
            placeholder="e.g. Emergency fund, a trip, a car"
            aria-invalid={e.showErrors && !form.name.trim() ? true : undefined}
          />
        </FormRow>
        <AmountWell
          question="How much do you need?"
          currency={e.currency}
          amount={form.target}
          onAmount={(v) => set('target', v)}
        >
          <span className="text-[12px] font-medium text-fp-text-3">
            Optional · leave empty to just keep saving
          </span>
        </AmountWell>
        <div>
          <FieldLabel optional>By when?</FieldLabel>
          <div className="flex items-center gap-2">
            <DateField
              className="min-w-0 flex-1"
              value={form.dueDate}
              onChange={(iso) => set('dueDate', iso)}
              dateFormat={dateFormat}
              ariaLabel="By when?"
              placeholder="No date"
            />
            {form.dueDate ? (
              <button
                type="button"
                onClick={() => set('dueDate', '')}
                className="flex-none rounded-full border-[1.5px] border-fp-border px-3 py-2 text-[13px] font-bold text-fp-text-2 hover:border-fp-border-strong"
              >
                No date
              </button>
            ) : null}
          </div>
        </div>
        {form.dueDate ? null : (
          <div>
            <FieldLabel htmlFor="goal-monthly">How much each month?</FieldLabel>
            <label className="flex items-center gap-2 rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface-2 px-[14px] py-3 focus-within:border-fp-accent">
              <span className="text-[14px] font-extrabold text-fp-text-2">
                {currencySymbol(e.currency)}
              </span>
              <input
                id="goal-monthly"
                aria-label="How much each month?"
                {...monthlyInput}
                className="min-w-0 flex-1 border-none bg-transparent text-[14px] font-semibold text-fp-text tabular-nums outline-none placeholder:text-fp-text-3"
              />
              <span className="text-[13px] font-semibold text-fp-text-3">
                a month
              </span>
            </label>
          </div>
        )}
        <div>
          <FieldLabel>Save in</FieldLabel>
          <WalletPills
            label="Save in"
            wallets={e.wallets}
            value={form.saveWalletId}
            onChange={(w) => set('saveWalletId', w)}
          />
        </div>
        <div>
          <FieldLabel>How important?</FieldLabel>
          <PillSwitch
            label="How important?"
            options={[
              { value: 'must', label: 'Must have' },
              { value: 'nice', label: 'Nice to have' },
            ]}
            value={form.mustHave ? 'must' : 'nice'}
            onChange={(v) => set('mustHave', v === 'must')}
          />
        </div>
        <InfoLine>{e.preview}</InfoLine>
        <MoreOptions>
          <div>
            <FieldLabel>Colour</FieldLabel>
            <ColorSwatches
              label="Colour"
              colors={ITEM_COLORS}
              value={form.color}
              onChange={(c) => set('color', c)}
            />
          </div>
        </MoreOptions>
      </ResponsiveDialog>
      {guard.prompt}
    </>
  )
}
