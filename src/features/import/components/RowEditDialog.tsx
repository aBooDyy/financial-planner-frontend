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
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { stripReference } from '#/features/import/data/dedupe'
import {
  categoryValue,
  splitCategoryValue,
} from '#/features/import/data/values'
import {
  amountInputProps,
  minorToInputValue,
  parseAmountToMinor,
} from '#/lib/currency'
import { usePreferencesStore } from '#/stores/preferences'
import type { RowPatch } from '#/features/import/data/rowEdits'
import type { TargetGroup } from '#/features/import/data/values'
import type { MappingDefaults, ParsedRow } from '#/features/import/data/types'
import type { TxType } from '#/features/transactions/api/types'
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
const NO_WALLET = '__none__'

type Form = {
  date: string
  amount: string
  currency: CurrencyCode
  type: TxType
  walletId: string
  category: string
  note: string
}

const formFor = (row: ParsedRow, defaults: Props['defaults']): Form => {
  const draft = row.draft
  const currency = draft?.currency ?? defaults.currency
  return {
    date: draft?.date ?? '',
    amount: draft === null ? '' : minorToInputValue(draft.amount, currency),
    currency,
    type: draft?.type ?? 'spend',
    walletId: draft?.walletId ?? defaults.walletId ?? '',
    category: categoryValue(
      draft?.category ?? defaults.category,
      draft?.subcategory ?? null,
    ),
    note: stripReference(draft?.note ?? null) ?? '',
  }
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
  const [initial] = useState<Form>(() => formFor(row, defaults))
  const [form, setForm] = useState<Form>(initial)

  const set = <TKey extends keyof Form>(key: TKey, value: Form[TKey]) =>
    setForm({ ...form, [key]: value })

  const amountMinor = parseAmountToMinor(form.amount, form.currency)
  const valid = form.date !== '' && amountMinor !== null && form.walletId !== ''

  const submit = () => {
    if (!valid) return
    const patch: RowPatch = {}
    if (form.date !== initial.date) patch.date = form.date
    if (form.amount !== initial.amount) patch.amountMinor = amountMinor
    if (form.currency !== initial.currency) patch.currency = form.currency
    if (form.type !== initial.type) patch.type = form.type
    if (form.walletId !== initial.walletId) patch.walletId = form.walletId
    if (form.category !== initial.category) {
      const { category, subcategory } = splitCategoryValue(form.category)
      patch.category = category
      patch.subcategory = subcategory
    }
    if (form.note !== initial.note) patch.note = form.note.trim() || null
    onSave(row.index, patch)
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

        <div>
          <Label className={LABEL}>Direction</Label>
          <ToggleGroup
            type="single"
            value={form.type}
            spacing={1}
            aria-label="Money in or out"
            className="w-full rounded-xl bg-fp-surface-2 p-1"
            onValueChange={(value) => {
              if (value) set('type', value as TxType)
            }}
          >
            <ToggleGroupItem value="spend" className="flex-1 rounded-[9px]">
              Money out
            </ToggleGroupItem>
            <ToggleGroupItem value="income" className="flex-1 rounded-[9px]">
              Money in
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div>
          <Label className={LABEL} htmlFor="row-wallet">
            Account
          </Label>
          <Select
            value={form.walletId === '' ? NO_WALLET : form.walletId}
            onValueChange={(value) =>
              set('walletId', value === NO_WALLET ? '' : value)
            }
          >
            <SelectTrigger id="row-wallet" aria-invalid={form.walletId === ''}>
              <SelectValue placeholder="Pick an account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_WALLET}>No account</SelectItem>
              {wallets.map((group, index) => (
                <SelectGroup key={group.label ?? `wallets-${index}`}>
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
