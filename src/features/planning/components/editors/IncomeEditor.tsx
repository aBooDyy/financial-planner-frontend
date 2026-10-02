import { Check } from 'lucide-react'
import { AmountWell } from '#/components/dialog/AmountWell'
import { ColorSwatches } from '#/components/dialog/ColorSwatches'
import { DialogActions } from '#/components/dialog/DialogActions'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import { useEditorReady } from '#/features/planning/hooks/useEditorReady'
import { useIncomeEditor } from '#/features/planning/hooks/useIncomeEditor'
import { ITEM_COLORS } from '#/features/planning/view/colors'
import type { RepeatPick } from '#/features/planning/view/repeat'
import { usePreferencesStore } from '#/stores/preferences'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { MoreOptions } from './fields/MoreOptions'
import { RepeatField } from './fields/RepeatField'
import { WalletMenuPill } from './fields/WalletMenuPill'

const PICKS: ReadonlyArray<RepeatPick> = [
  'weekly',
  'monthly',
  'quarterly',
  'semi',
  'annual',
  'custom',
]

type Props = {
  id: string | null
  onClose: () => void
  onDelete: (id: string) => void
}

/** New income / Edit income: how much, how often, when and where it lands. */
export function IncomeEditor(props: Props) {
  return useEditorReady() ? <IncomeEditorForm {...props} /> : null
}

function IncomeEditorForm({ id, onClose, onDelete }: Props) {
  const e = useIncomeEditor(id, onClose)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const guard = useDiscardGuard({ dirty: e.dirty, close: onClose })
  const { form, set } = e
  const monthly = form.repeat.pick === 'monthly'

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) guard.requestClose()
        }}
        title={e.stream ? `Edit ${e.stream.label}` : 'New income'}
        description="Salary or other money that comes in regularly."
        footer={
          <DialogActions
            hint={e.block}
            onDelete={e.stream ? () => onDelete(e.stream?.id ?? '') : undefined}
            onCancel={guard.requestClose}
            submitLabel={e.stream ? 'Save changes' : 'Add income'}
            ready={e.block === null}
            onSubmit={() => void e.save()}
          />
        }
      >
        <FormRow id="income-label" label="What is it?">
          <Input
            id="income-label"
            value={form.label}
            onChange={(ev) => set('label', ev.target.value)}
            placeholder="e.g. Salary"
            aria-invalid={e.showErrors && !form.label.trim() ? true : undefined}
          />
        </FormRow>
        <AmountWell
          question="How much comes in?"
          currency={e.currency}
          amount={form.amount}
          onAmount={(v) => set('amount', v)}
        >
          <WalletMenuPill
            lead="Paid into"
            wallets={e.wallets}
            value={form.walletId}
            onChange={(w) => set('walletId', w)}
          />
        </AmountWell>
        <RepeatField
          label="How often?"
          picks={PICKS}
          value={form.repeat}
          onChange={(r) => set('repeat', r)}
        />
        {monthly ? (
          <div>
            <FieldLabel htmlFor="income-day">Paid on</FieldLabel>
            <div className="flex flex-wrap items-center gap-[10px]">
              <Input
                id="income-day"
                value={form.day}
                onChange={(ev) =>
                  set('day', ev.target.value.replace(/\D/g, ''))
                }
                inputMode="numeric"
                maxLength={2}
                placeholder="25"
                className="w-[72px] text-center tabular-nums"
              />
              <span className="text-[13px] font-semibold text-fp-text-2">
                of each month
              </span>
            </div>
          </div>
        ) : (
          <div>
            <FieldLabel>Next payday</FieldLabel>
            <DateField
              value={form.anchorDate}
              onChange={(iso) => set('anchorDate', iso)}
              dateFormat={dateFormat}
              ariaLabel="Next payday"
              hint
            />
          </div>
        )}
        <InfoLine>{e.preview}</InfoLine>
        {e.isMain ? (
          <span className="flex items-center gap-[6px] self-start rounded-full bg-fp-accent-soft px-[10px] py-[5px] text-[12.5px] font-bold text-fp-accent-ink">
            <Check size={14} strokeWidth={2.6} aria-hidden />
            Sets my pay periods
          </span>
        ) : e.hasMain ? (
          <ToggleCard
            title="Use for my pay periods"
            description="Your plan splits each paycheck from this income instead."
            checked={e.useForPeriods}
            onCheckedChange={e.setUseForPeriods}
          />
        ) : null}
        <MoreOptions defaultOpen={!!e.stream}>
          <div>
            <FieldLabel>Category</FieldLabel>
            <CategoryPicker
              type="income"
              categoryId={form.categoryId}
              onChange={(c) => set('categoryId', c)}
            />
          </div>
          <ToggleCard
            title="Log it automatically when it arrives"
            description="Records the income on its payday without asking."
            checked={form.autolog}
            onCheckedChange={(v) => set('autolog', v)}
          />
          <div>
            <FieldLabel optional>Ends</FieldLabel>
            <DateField
              value={form.endsOn}
              onChange={(iso) => set('endsOn', iso)}
              dateFormat={dateFormat}
              ariaLabel="Ends"
              placeholder="Never"
            />
          </div>
          <FormRow id="income-note" label="Note" optional>
            <Input
              id="income-note"
              value={form.note}
              onChange={(ev) => set('note', ev.target.value)}
              maxLength={200}
            />
          </FormRow>
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
