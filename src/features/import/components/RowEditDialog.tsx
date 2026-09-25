import { useState } from 'react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { DateField } from '#/components/DateField'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  formFor,
  formValid,
  hasFlow,
  patchFor,
} from '#/features/import/data/rowEditForm'
import { amountInputProps, parseAmountToMinor } from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import { RowKindField } from './RowKindField'
import { WalletSelect } from './WalletSelect'
import type { RowPatch } from '#/features/import/data/rowEdits'
import type { RowForm } from '#/features/import/data/rowEditForm'
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

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'

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
        <>
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!valid} onClick={submit}>
            Save row
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div>
          <Label className={LABEL}>Date</Label>
          <DateField
            value={form.date}
            dateFormat={dateFormat}
            ariaLabel="Date"
            invalid={form.date === ''}
            onChange={(iso) => set('date', iso)}
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2.5">
          <div>
            <Label className={LABEL} htmlFor="row-amount">
              Amount
            </Label>
            <Input
              id="row-amount"
              dir="ltr"
              value={form.amount}
              aria-invalid={amountMinor === null}
              {...amountInputProps(form.currency)}
              onChange={(event) => set('amount', event.target.value)}
            />
          </div>
          <div>
            <Label className={LABEL}>Currency</Label>
            <CurrencyPicker
              value={form.currency}
              base={baseCurrency}
              label="Row currency"
              onChange={(code) => set('currency', code)}
            />
          </div>
        </div>

        <RowKindField
          kind={form.kind}
          flow={form.flow}
          onKind={(kind) => set('kind', kind)}
          onFlow={(flow) => set('flow', flow)}
        />

        <div>
          <Label className={LABEL} htmlFor="row-wallet">
            Account
          </Label>
          <WalletSelect
            id="row-wallet"
            value={form.walletId}
            wallets={wallets}
            onChange={(walletId) => set('walletId', walletId)}
          />
        </div>

        {form.kind === 'transfer' ? (
          <div>
            <Label className={LABEL} htmlFor="row-counterpart">
              Other account
            </Label>
            <WalletSelect
              id="row-counterpart"
              value={form.counterpartId}
              wallets={wallets}
              exclude={form.walletId}
              onChange={(walletId) => set('counterpartId', walletId)}
            />
            {pairedWith !== null ? (
              <p className="mt-[6px] text-[12px] text-fp-text-3">
                Paired with row {pairedWith + 1} of this file. Changing the
                amount, date, direction or either account splits the pair.
              </p>
            ) : null}
          </div>
        ) : null}

        {hasFlow(form.kind) ? null : (
          <div>
            <Label className={LABEL} htmlFor="row-category">
              Category
            </Label>
            <Select
              value={form.category}
              onValueChange={(value) => set('category', value)}
            >
              <SelectTrigger id="row-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((group, index) => (
                  <SelectGroup key={group.label ?? `categories-${index}`}>
                    {group.label ? (
                      <SelectLabel>{group.label}</SelectLabel>
                    ) : null}
                    {group.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label className={LABEL} htmlFor="row-note">
            Note
          </Label>
          <Input
            id="row-note"
            value={form.note}
            onChange={(event) => set('note', event.target.value)}
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}
