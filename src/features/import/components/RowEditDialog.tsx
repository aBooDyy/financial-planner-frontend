import { useState } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { DateField } from '#/components/DateField'
import { AmountWell } from '#/components/dialog/AmountWell'
import type { AmountTone } from '#/components/dialog/AmountWell'
import { DialogActions } from '#/components/dialog/DialogActions'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  formFor,
  formValid,
  hasFlow,
  patchFor,
} from '#/features/import/data/rowEditForm'
import { parseAmountToMinor } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { RowKindField } from './RowKindField'
import { TargetPicker } from './TargetPicker'
import { WalletSelect } from './WalletSelect'
import type { RowPatch } from '#/features/import/data/rowEdits'
import type { RowForm, RowKind } from '#/features/import/data/rowEditForm'
import type { TargetGroup } from '#/features/import/data/values'
import type { MappingDefaults, ParsedRow } from '#/features/import/data/types'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  row: ParsedRow | null
  onClose: () => void
  onSave: (index: number, patch: RowPatch) => void
  wallets: ReadonlyArray<TargetGroup>
  categories: ReadonlyArray<TargetGroup>
  baseCurrency: CurrencyCode
  /** What step ② falls back to, used where the row itself resolved nothing. */
  defaults: MappingDefaults
}

const AMOUNT_TONE: Record<RowKind, AmountTone> = {
  spend: 'spend',
  income: 'accent',
  transfer: 'transfer',
  adjustment: 'neutral',
}

/**
 * One row, corrected by hand. Only the fields the user actually changed become a patch —
 * everything else keeps deriving from the file, so a later mapping change still reaches it.
 *
 * The form is seeded by the mount, keyed on which row is open: `row` and `defaults` are
 * rebuilt under an open dialog whenever anything upstream re-derives, and re-seeding on
 * their identity discarded whatever the user had typed.
 */
export function RowEditDialog({ row, ...rest }: Props) {
  if (row === null) return null
  return <RowEditForm key={row.index} row={row} {...rest} />
}

function RowEditForm({
  row,
  onClose,
  onSave,
  wallets,
  categories,
  baseCurrency,
  defaults,
}: Props & { row: ParsedRow }) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const [initial] = useState<RowForm>(() => formFor(row, defaults))
  const [form, setForm] = useState<RowForm>(initial)

  const set = <TKey extends keyof RowForm>(key: TKey, value: RowForm[TKey]) =>
    setForm({ ...form, [key]: value })

  const amountMinor = parseAmountToMinor(form.amount, form.currency)
  const valid = formValid(form)
  const pairedWith = row.transfer?.pairIndex ?? null

  const submit = () => {
    if (!valid) return
    onSave(row.index, patchFor(initial, form))
    onClose()
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Row ${row.index + 1}`}
      description={`Line ${row.line} of the file. Fixing it re-checks it straight away.`}
      footer={
        <DialogActions
          onCancel={onClose}
          submitLabel="Save row"
          disabled={!valid}
          onSubmit={submit}
        />
      }
    >
      <AmountWell
        question="How much?"
        currency={form.currency}
        amount={form.amount}
        onAmount={(v) => set('amount', v)}
        invalid={amountMinor === null}
        tone={AMOUNT_TONE[form.kind]}
      >
        <CurrencyPicker
          value={form.currency}
          base={baseCurrency}
          label="Row currency"
          align="center"
          appearance="pill"
          onChange={(code) => set('currency', code)}
        />
      </AmountWell>

      <RowKindField
        kind={form.kind}
        flow={form.flow}
        onKind={(kind) => set('kind', kind)}
        onFlow={(flow) => set('flow', flow)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <FieldLabel>Date</FieldLabel>
          <DateField
            value={form.date}
            dateFormat={dateFormat}
            ariaLabel="Date"
            invalid={form.date === ''}
            hint
            onChange={(iso) => set('date', iso)}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel htmlFor="row-wallet">
            {form.kind === 'transfer' ? 'From which account?' : 'Account'}
          </FieldLabel>
          <WalletSelect
            id="row-wallet"
            value={form.walletId}
            wallets={wallets}
            onChange={(walletId) => set('walletId', walletId)}
          />
        </div>
      </div>

      {form.kind === 'transfer' ? (
        <div>
          <FieldLabel htmlFor="row-counterpart">Other account</FieldLabel>
          <WalletSelect
            id="row-counterpart"
            value={form.counterpartId}
            wallets={wallets}
            exclude={form.walletId}
            onChange={(walletId) => set('counterpartId', walletId)}
          />
          <FieldMessage
            help={
              pairedWith !== null
                ? `Paired with row ${pairedWith + 1} of this file. Changing the amount, date, direction or either account splits the pair.`
                : null
            }
          />
        </div>
      ) : null}

      {hasFlow(form.kind) ? null : (
        <div>
          <FieldLabel htmlFor="row-category">Category</FieldLabel>
          <TargetPicker
            id="row-category"
            value={form.categoryId}
            placeholder="Pick a category"
            searchPlaceholder="Search categories…"
            groups={categories}
            onChange={(value) => set('categoryId', value)}
          />
        </div>
      )}

      <div>
        <FieldLabel htmlFor="row-note" optional>
          Note
        </FieldLabel>
        <Input
          id="row-note"
          value={form.note}
          onChange={(event) => set('note', event.target.value)}
        />
      </div>
    </ResponsiveDialog>
  )
}
