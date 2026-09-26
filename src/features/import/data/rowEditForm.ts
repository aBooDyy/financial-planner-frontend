import { stripReference } from './dedupe'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import type { RowPatch } from './rowEdits'
import type { MappingDefaults, ParsedRow, RowIntent } from './types'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'

/**
 * The single-row editor as data: what it opens with, when it may save, and the patch a save
 * produces. Only the fields the user actually changed become a patch — everything else keeps
 * deriving from the file, so a later mapping change still reaches it.
 */

/** What a row is, as the editor offers it: spending and income are cash flow's two directions. */
export type RowKind = 'spend' | 'income' | 'transfer' | 'adjustment'

export const ROW_KINDS: ReadonlyArray<{ value: RowKind; label: string }> = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'adjustment', label: 'Adjustment' },
]

export type RowForm = {
  date: string
  amount: string
  currency: CurrencyCode
  kind: RowKind
  /** Money out or in — asked separately only for a transfer or an adjustment. */
  flow: TxType
  walletId: string
  /** A transfer's other account; '' while none is chosen. */
  counterpartId: string
  categoryId: string
  note: string
}

export const hasFlow = (kind: RowKind): boolean =>
  kind === 'transfer' || kind === 'adjustment'

const intentOf = (kind: RowKind): RowIntent =>
  hasFlow(kind) ? (kind as RowIntent) : 'cashflow'

const typeOf = (form: RowForm): TxType =>
  hasFlow(form.kind) ? form.flow : (form.kind as TxType)

export const formFor = (row: ParsedRow, defaults: MappingDefaults): RowForm => {
  const draft = row.draft
  const currency = draft?.currency ?? defaults.currency
  const type = draft?.type ?? 'spend'
  return {
    date: draft?.date ?? '',
    amount: draft === null ? '' : minorToInputValue(draft.amount, currency),
    currency,
    kind: row.intent === 'cashflow' ? type : row.intent,
    flow: type,
    walletId: draft?.walletId ?? defaults.walletId ?? '',
    counterpartId: row.transfer?.counterpartId ?? '',
    categoryId: draft?.categoryId ?? defaults.categoryIds[type],
    note: stripReference(draft?.note ?? null) ?? '',
  }
}

export const formValid = (form: RowForm): boolean =>
  form.date !== '' &&
  parseAmountToMinor(form.amount, form.currency) !== null &&
  form.walletId !== '' &&
  (form.kind !== 'transfer' ||
    (form.counterpartId !== '' && form.counterpartId !== form.walletId))

export const patchFor = (initial: RowForm, form: RowForm): RowPatch => {
  const patch: RowPatch = {}
  if (form.date !== initial.date) patch.date = form.date
  if (form.amount !== initial.amount) {
    const minor = parseAmountToMinor(form.amount, form.currency)
    if (minor !== null) patch.amountMinor = minor
  }
  if (form.currency !== initial.currency) patch.currency = form.currency
  if (intentOf(form.kind) !== intentOf(initial.kind)) {
    patch.intent = intentOf(form.kind)
  }
  if (typeOf(form) !== typeOf(initial)) patch.type = typeOf(form)
  if (form.walletId !== initial.walletId) patch.walletId = form.walletId
  if (
    form.kind === 'transfer' &&
    form.counterpartId !== initial.counterpartId
  ) {
    patch.counterpartId = form.counterpartId
  }
  if (!hasFlow(form.kind) && form.categoryId !== initial.categoryId) {
    patch.categoryId = form.categoryId
  }
  if (form.note !== initial.note) patch.note = form.note.trim() || null
  return patch
}
