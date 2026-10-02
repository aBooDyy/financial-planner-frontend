import { AmountWell } from '#/components/dialog/AmountWell'
import { Chip, ChipRow } from '#/components/dialog/Chip'
import { ColorSwatches } from '#/components/dialog/ColorSwatches'
import { DialogActions } from '#/components/dialog/DialogActions'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { useDiscardGuard } from '#/components/dialog/useDiscardGuard'
import { DateField } from '#/components/DateField'
import { FieldLabel } from '#/components/FieldLabel'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import { useBillEditor } from '#/features/planning/hooks/useBillEditor'
import { useEditorReady } from '#/features/planning/hooks/useEditorReady'
import { ITEM_COLORS } from '#/features/planning/view/colors'
import { perYearOf } from '#/features/planning/view/repeat'
import type { RepeatPick } from '#/features/planning/view/repeat'
import { usePreferencesStore } from '#/stores/preferences'
import { InfoLine } from '#/features/planning/components/kit/InfoLine'
import { MerchantField } from './fields/MerchantField'
import { MoreOptions } from './fields/MoreOptions'
import { RepeatField } from './fields/RepeatField'
import { WalletMenuPill } from './fields/WalletMenuPill'
import { WalletPills } from './fields/WalletPills'

const PICKS: ReadonlyArray<RepeatPick> = [
  'once',
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

/** New bill / Edit bill (04 §4): short by default, the rest behind More options. */
export function BillEditor(props: Props) {
  return useEditorReady() ? <BillEditorForm {...props} /> : null
}

function BillEditorForm({ id, onClose, onDelete }: Props) {
  const e = useBillEditor(id, onClose)
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const guard = useDiscardGuard({ dirty: e.dirty, close: onClose })
  const { form, set } = e
  const once = form.repeat.pick === 'once'
  const savesUp = once || perYearOf(form.repeat) < 12

  return (
    <>
      <ResponsiveDialog
        open
        onOpenChange={(open) => {
          if (!open) guard.requestClose()
        }}
        title={e.bill ? `Edit ${e.bill.name}` : 'New bill'}
        description="Something you pay, once or on repeat."
        footer={
          <DialogActions
            hint={e.block}
            onDelete={e.bill ? () => onDelete(e.bill?.id ?? '') : undefined}
            onCancel={guard.requestClose}
            submitLabel={e.bill ? 'Save changes' : 'Add bill'}
            ready={e.block === null}
            onSubmit={() => void e.save()}
          />
        }
      >
        <FormRow id="bill-name" label="What is it?">
          <Input
            id="bill-name"
            value={form.name}
            onChange={(ev) => set('name', ev.target.value)}
            placeholder="e.g. Rent, Car insurance"
            aria-invalid={e.showErrors && !form.name.trim() ? true : undefined}
          />
        </FormRow>
        <AmountWell
          question="How much?"
          currency={e.currency}
          amount={form.amount}
          onAmount={(v) => set('amount', v)}
          invalid={e.showErrors && e.block === 'Enter how much it is'}
        >
          <WalletMenuPill
            lead="Paid from"
            wallets={e.wallets}
            value={form.walletId}
            onChange={(w) => set('walletId', w)}
            noneLabel="Decide when paying"
          />
        </AmountWell>
        <RepeatField
          label="Repeats"
          picks={PICKS}
          value={form.repeat}
          onChange={(r) => set('repeat', r)}
        />
        <div>
          <FieldLabel>{once ? 'When is it due?' : 'Next due date'}</FieldLabel>
          <DateField
            value={form.nextDue}
            onChange={(iso) => set('nextDue', iso)}
            dateFormat={dateFormat}
            ariaLabel={once ? 'When is it due?' : 'Next due date'}
            invalid={e.showErrors && !form.nextDue}
            hint
          />
        </div>
        <div>
          <FieldLabel>Category</FieldLabel>
          <CategoryPicker
            type="spend"
            categoryId={form.categoryId}
            onChange={(c) => set('categoryId', c)}
          />
        </div>
        <InfoLine>{e.preview}</InfoLine>
        <MoreOptions defaultOpen={!!e.bill}>
          {once ? null : (
            <div>
              <FieldLabel>Ends</FieldLabel>
              <ChipRow label="Ends">
                <Chip
                  size="sm"
                  active={!form.endsOn}
                  onClick={() => set('endsOn', '')}
                >
                  Never
                </Chip>
                <Chip
                  size="sm"
                  active={!!form.endsOn}
                  onClick={() =>
                    set('endsOn', form.endsOn || form.nextDue || '')
                  }
                >
                  On a date
                </Chip>
              </ChipRow>
              {form.endsOn ? (
                <DateField
                  className="mt-[10px]"
                  value={form.endsOn}
                  onChange={(iso) => set('endsOn', iso)}
                  dateFormat={dateFormat}
                  ariaLabel="Ends on"
                />
              ) : null}
            </div>
          )}
          <ToggleCard
            title="Auto-pay"
            description="Log it automatically on the due date."
            checked={form.autopay}
            onCheckedChange={(v) => set('autopay', v)}
          />
          <div>
            <FieldLabel>How important?</FieldLabel>
            <PillSwitch
              label="How important?"
              options={[
                { value: 'must', label: 'Must pay' },
                { value: 'nice', label: 'Nice to have' },
              ]}
              value={form.mustPay ? 'must' : 'nice'}
              onChange={(v) => set('mustPay', v === 'must')}
            />
          </div>
          {savesUp ? (
            <div>
              <FieldLabel>Save up in</FieldLabel>
              <WalletPills
                label="Save up in"
                wallets={e.wallets}
                value={form.saveWalletId ?? form.walletId}
                onChange={(w) => set('saveWalletId', w)}
              />
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormRow id="bill-merchant" label="Merchant" optional>
              <MerchantField
                id="bill-merchant"
                value={form.merchantId}
                onChange={(m) => set('merchantId', m)}
                placeholder="e.g. Tawuniya"
              />
            </FormRow>
            <FormRow id="bill-note" label="Note" optional>
              <Input
                id="bill-note"
                value={form.note}
                onChange={(ev) => set('note', ev.target.value)}
                placeholder="Policy number…"
                maxLength={200}
              />
            </FormRow>
          </div>
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
