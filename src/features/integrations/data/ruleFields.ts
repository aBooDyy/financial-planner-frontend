import type { LocatorField } from '#/features/integrations/api/ruleTypes'

type FieldMeta = {
  label: string
  /** Why a person would add it — shown on the chip that adds it. */
  hint?: string
}

export const FIELD_META: Record<LocatorField, FieldMeta> = {
  amount: { label: 'Amount' },
  currency: { label: 'Currency' },
  date: { label: 'Date' },
  merchant: { label: 'Merchant' },
  external_id: { label: 'Reference', hint: 'recommended' },
  type: { label: 'Type' },
  note: { label: 'Note' },
  wallet: { label: 'Account' },
  category: { label: 'Category' },
  subcategory: { label: 'Subcategory' },
}

/** Display order. */
export const FIELD_ORDER: LocatorField[] = [
  'amount',
  'currency',
  'date',
  'merchant',
  'external_id',
  'type',
  'note',
  'wallet',
  'category',
  'subcategory',
]

/**
 * The fields a tap moves on through, in order, and the ones every rule shows. An optional
 * field is only ever the target because the user chose it.
 */
export const HOP_FIELDS: LocatorField[] = ['amount', 'currency', 'date']

export const isHopField = (field: LocatorField): boolean =>
  HOP_FIELDS.includes(field)

/** How many words a text rule's filter list may hold — the server's own limit. */
export const TEXT_TERMS_MAX = 10
