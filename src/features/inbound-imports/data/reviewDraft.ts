import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { DELETED_CATEGORY_ID } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'

export type ReviewDraft = {
  type: TxType
  amount: string
  currency: CurrencyCode
  date: string
  /** The leaf filed under: a subcategory's id, else its root's. */
  categoryId: string
  walletId: string
  merchant: string
  note: string
}

/** What confirm sends for one import; every value is the user's last word. */
export type ConfirmInput = {
  walletId: string
  categoryId: string
  type: TxType
  amount: number
  currency: CurrencyCode
  date: string
  merchant?: string
  note?: string
}

const pickWallet = (
  wallets: LocalBalanceNode[],
  suggested: string | null,
): LocalBalanceNode | null =>
  wallets.find((w) => w.id === suggested) ??
  (wallets.length > 0 ? wallets[0] : null)

/** What the source said, else what its suggested category is filed as, else a spend. */
const initialType = (
  item: LocalInboundImport,
  catalog: CategoryCatalog,
): TxType => {
  if (item.suggestedType) return item.suggestedType
  const suggested = item.suggestedCategoryId
  return suggested && catalog.has(suggested)
    ? catalog.get(suggested).type
    : 'spend'
}

export function initialDraft(
  item: LocalInboundImport,
  wallets: LocalBalanceNode[],
  catalog: CategoryCatalog,
): ReviewDraft {
  const wallet = pickWallet(wallets, item.suggestedWalletId)
  const currency = item.currency ?? wallet?.currency ?? 'SAR'
  return {
    type: initialType(item, catalog),
    amount: item.amount != null ? minorToInputValue(item.amount, currency) : '',
    currency,
    date: item.occurredOn ?? ymd(startOfToday()),
    categoryId: item.suggestedCategoryId ?? '',
    walletId: wallet?.id ?? '',
    merchant: item.suggestedMerchant ?? '',
    note: '',
  }
}

/**
 * The draft as this device can honour it. The category is kept while the catalog holds it
 * under the draft's type, else the type's fallback; the account while it is one of the loaded
 * wallets, else the suggested one. Derived rather than stored, so a suggestion naming rows
 * Dexie has not delivered yet is applied once they arrive, and a type switch re-points it.
 */
export function resolveDraft(
  raw: ReviewDraft,
  item: LocalInboundImport,
  wallets: LocalBalanceNode[],
  catalog: CategoryCatalog,
): ReviewDraft {
  const entry = catalog.get(raw.categoryId)
  const categoryId =
    entry.id !== DELETED_CATEGORY_ID && entry.type === raw.type
      ? entry.id
      : (catalog.fallbackFor(raw.type)?.id ?? '')
  const walletId = wallets.some((w) => w.id === raw.walletId)
    ? raw.walletId
    : (pickWallet(wallets, item.suggestedWalletId)?.id ?? '')
  return { ...raw, categoryId, walletId }
}

export type DraftState = {
  amountMissing: boolean
  currencyMissing: boolean
  /** The amount or currency still has to be filled in by hand. */
  needsDetails: boolean
  /** Everything confirm needs is there. */
  ready: boolean
}

export function draftState(draft: ReviewDraft): DraftState {
  const minor = parseAmountToMinor(draft.amount, draft.currency)
  const amountMissing = minor == null || minor <= 0
  const currencyMissing = !draft.currency
  const needsDetails = amountMissing || currencyMissing
  return {
    amountMissing,
    currencyMissing,
    needsDetails,
    ready: !needsDetails && !!draft.walletId && !!draft.categoryId,
  }
}

/** The confirm call for a draft, or why it cannot be made yet. */
export function confirmInput(
  item: LocalInboundImport,
  draft: ReviewDraft,
): { input: ConfirmInput } | { problem: string } {
  const amount = parseAmountToMinor(draft.amount, draft.currency)
  if (amount == null || amount <= 0) return { problem: 'Enter the amount.' }
  if (!draft.walletId) return { problem: 'Choose an account for this entry.' }
  if (!draft.categoryId) return { problem: 'Choose a category for this entry.' }
  const merchant = draft.merchant.trim()
  const note = draft.note.trim()
  return {
    input: {
      walletId: draft.walletId,
      categoryId: draft.categoryId,
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
    },
  }
}
