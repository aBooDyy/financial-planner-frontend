import { useState } from 'react'
import type { LocalBalanceNode, LocalPendingImport } from '#/db/types'
import { readLineValues } from '#/features/email-sync/data/lineValues'
import {
  confirmImport,
  dismissImport,
} from '#/features/email-sync/data/mutations'
import type { TxType } from '#/features/transactions/api/types'
import {
  categoriesByType,
  subcategoriesOf,
} from '#/features/transactions/categories'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import { messageForApiError } from '#/lib/errorMessages'

export type ReviewDraft = {
  type: TxType
  amount: string
  currency: CurrencyCode
  date: string
  category: string
  subcategory: string | null
  walletId: string
  merchant: string
  note: string
}

const firstCategoryOf = (type: TxType): string =>
  categoriesByType(type)[0]?.id ?? 'other'

const knownCategory = (id: string | null, type: TxType): string =>
  categoriesByType(type).some((c) => c.id === id)
    ? (id as string)
    : firstCategoryOf(type)

const knownSubcategory = (id: string | null, category: string): string | null =>
  id && subcategoriesOf(category).some((s) => s.id === id) ? id : null

function initialDraft(
  item: LocalPendingImport,
  wallets: LocalBalanceNode[],
): ReviewDraft {
  const wallet = wallets.length > 0 ? wallets[0] : null
  const currency = item.currency ?? wallet?.currency ?? 'SAR'
  const category = knownCategory(item.suggestedCategory, 'spend')
  return {
    type: 'spend',
    amount: item.amount != null ? minorToInputValue(item.amount, currency) : '',
    currency,
    date: item.emailDate ?? ymd(startOfToday()),
    category,
    subcategory: knownSubcategory(item.suggestedSubcategory, category),
    walletId: wallet?.id ?? '',
    merchant: item.suggestedMerchant ?? '',
    note: '',
  }
}

/**
 * Per-import review state. What the sync parsed is only a starting point: every field is
 * editable here, and for an alert that parsed empty this is the only way it ever reaches the
 * ledger. Confirm sends the draft as overrides — the backend keeps them on the import too.
 */
export function useImportReview(
  item: LocalPendingImport,
  wallets: LocalBalanceNode[],
) {
  const [draft, setDraft] = useState<ReviewDraft>(() =>
    initialDraft(item, wallets),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsDetails = item.amount == null || item.currency == null

  const setField = <TKey extends keyof ReviewDraft>(
    key: TKey,
    value: ReviewDraft[TKey],
  ) => setDraft((d) => ({ ...d, [key]: value }))

  const setType = (type: TxType) =>
    setDraft((d) => {
      const category = knownCategory(d.category, type)
      return {
        ...d,
        type,
        category,
        subcategory: knownSubcategory(d.subcategory, category),
      }
    })

  const setCategory = (category: string) =>
    setDraft((d) => ({
      ...d,
      category,
      subcategory: knownSubcategory(d.subcategory, category),
    }))

  /** Fill amount (and currency) from a line the user tapped in the email preview. */
  const useLine = (line: string) =>
    setDraft((d) => {
      const { amountMinor, currency } = readLineValues(line, d.currency)
      const next = currency ?? d.currency
      return {
        ...d,
        currency: next,
        amount:
          amountMinor != null ? minorToInputValue(amountMinor, next) : d.amount,
      }
    })

  const confirm = async (): Promise<boolean> => {
    const amount = parseAmountToMinor(draft.amount, draft.currency)
    if (!draft.walletId) {
      setError('Choose an account for this entry.')
      return false
    }
    if (amount == null || amount <= 0) {
      setError('Enter the amount — you can tap it in the email below.')
      return false
    }
    setBusy(true)
    setError(null)
    try {
      const merchant = draft.merchant.trim()
      const note = draft.note.trim()
      await confirmImport(item, {
        walletId: draft.walletId,
        category: draft.category,
        subcategory: draft.subcategory,
        type: draft.type,
        amount,
        currency: draft.currency,
        date: draft.date,
        // Only when edited — sending it again would re-count the merchant sighting.
        merchant:
          merchant && merchant !== (item.suggestedMerchant ?? '')
            ? merchant
            : undefined,
        note: note || undefined,
      })
      return true
    } catch (err) {
      setBusy(false)
      setError(messageForApiError(err))
      return false
    }
  }

  const dismiss = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await dismissImport(item)
    } catch (err) {
      setBusy(false)
      setError(messageForApiError(err))
    }
  }

  return {
    draft,
    busy,
    error,
    needsDetails,
    setField,
    setType,
    setCategory,
    useLine,
    confirm,
    dismiss,
  }
}

export type ImportReview = ReturnType<typeof useImportReview>
