import { useMemo, useState } from 'react'
import type { LocalBalanceNode, LocalInboundImport } from '#/db/types'
import { readLineValues } from '#/features/inbound-imports/data/lineValues'
import {
  firstTarget,
  nextTarget,
  readPick,
  unreadablePick,
} from '#/features/inbound-imports/data/pickValues'
import type {
  PayloadPick,
  PickField,
} from '#/features/inbound-imports/data/pickValues'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import {
  confirmImport,
  dismissImport,
} from '#/features/inbound-imports/data/mutations'
import type { TxType } from '#/features/transactions/api/types'
import type {
  CategoryCatalog,
  ResolvedCategory,
  ResolvedSub,
} from '#/features/categories/data/catalog'
import { startOfToday, ymd } from '#/features/transactions/data/planning'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import { messageForApiError } from '#/lib/errorMessages'

type ReviewDraft = {
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

/**
 * The draft's category and subcategory as the catalog can honour them. Derived rather than
 * stored, so a suggestion naming a category this device has not pulled yet is still the
 * one applied once the rows arrive.
 */
const FALLBACK_SLUG = 'other'

const resolveDraft = (
  draft: ReviewDraft,
  catalog: CategoryCatalog,
): ReviewDraft => {
  const ofType = catalog.byType(draft.type)
  const found = ofType.find((c) => c.slug === draft.category)
  const category = found ?? (ofType.length > 0 ? ofType[0] : null)
  const keepsSub =
    category !== null &&
    draft.subcategory !== null &&
    category.subs.some((s) => s.slug === draft.subcategory)
  return {
    ...draft,
    category: category === null ? FALLBACK_SLUG : category.slug,
    subcategory: keepsSub ? draft.subcategory : null,
  }
}

/**
 * The account the draft posts to, among the accounts this device holds. Derived like the
 * category, so a row that rendered before the accounts loaded still lands on the suggested
 * one — and one the user picked stays picked.
 */
const pickWallet = (
  wallets: LocalBalanceNode[],
  suggested: string | null,
): LocalBalanceNode | null =>
  wallets.find((w) => w.id === suggested) ??
  (wallets.length > 0 ? wallets[0] : null)

const resolveWallet = (
  walletId: string,
  wallets: LocalBalanceNode[],
  suggested: string | null,
): string =>
  wallets.some((w) => w.id === walletId)
    ? walletId
    : (pickWallet(wallets, suggested)?.id ?? '')

function initialDraft(
  item: LocalInboundImport,
  wallets: LocalBalanceNode[],
): ReviewDraft {
  const wallet = pickWallet(wallets, item.suggestedWalletId)
  const currency = item.currency ?? wallet?.currency ?? 'SAR'
  return {
    type: item.suggestedType ?? 'spend',
    amount: item.amount != null ? minorToInputValue(item.amount, currency) : '',
    currency,
    date: item.occurredOn ?? ymd(startOfToday()),
    category: item.suggestedCategory ?? '',
    subcategory: item.suggestedSubcategory,
    walletId: wallet?.id ?? '',
    merchant: item.suggestedMerchant ?? '',
    note: '',
  }
}

/**
 * Per-import review state. What the sync parsed is only a starting point: every field is
 * editable here, and for an import that parsed empty this is the only way it ever reaches the
 * ledger. Confirm sends the draft as overrides — the backend keeps them on the import too.
 */
export function useImportReview(
  item: LocalInboundImport,
  wallets: LocalBalanceNode[],
  catalog: CategoryCatalog,
) {
  const [raw, setDraft] = useState<ReviewDraft>(() =>
    initialDraft(item, wallets),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [target, setTarget] = useState<PickField>(() =>
    firstTarget(raw.amount, item.currency != null),
  )

  const draft = useMemo(
    () => ({
      ...resolveDraft(raw, catalog),
      walletId: resolveWallet(raw.walletId, wallets, item.suggestedWalletId),
    }),
    [raw, catalog, wallets, item.suggestedWalletId],
  )
  const categories: ResolvedCategory[] = catalog.byType(draft.type)
  const subs: ResolvedSub[] = catalog.subsOf(draft.category)

  const needsDetails = item.amount == null || item.currency == null
  const draftMinor = parseAmountToMinor(draft.amount, draft.currency)
  const amountMissing = draftMinor == null || draftMinor <= 0
  // Derived, so the complaint goes away the moment the amount is typed or tapped in.
  const amountError =
    attempted && amountMissing
      ? `Enter the amount — you can tap it in the ${bodyNoun(item.bodyFormat)} above.`
      : null

  const setField = <TKey extends keyof ReviewDraft>(
    key: TKey,
    value: ReviewDraft[TKey],
  ) => setDraft((d) => ({ ...d, [key]: value }))

  const setType = (type: TxType) => setDraft((d) => ({ ...d, type }))

  const setCategory = (category: string) =>
    setDraft((d) => ({ ...d, category }))

  /** Fill amount (and currency) from a line the user tapped in the body preview. */
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

  /** Fill the target field from a value tapped in a JSON payload, then hop to the next. */
  const pick = (value: PayloadPick) => {
    const picked = readPick(target, value, raw.currency)
    if (!picked) {
      setError(unreadablePick(target, value.text))
      return
    }
    setError(null)
    setDraft((d) => ({ ...d, ...picked }))
    setTarget(nextTarget(target, picked))
  }

  const confirm = async (): Promise<boolean> => {
    if (!draft.walletId) {
      setError('Choose an account for this entry.')
      return false
    }
    if (draftMinor == null || amountMissing) {
      setAttempted(true)
      return false
    }
    const amount = draftMinor
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

  /** True once the server has it; on failure the row stays with the reason. */
  const dismiss = async (): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await dismissImport(item)
      return true
    } catch (err) {
      setBusy(false)
      setError(messageForApiError(err))
      return false
    }
  }

  return {
    draft,
    categories,
    subs,
    busy,
    error:
      error ??
      (amountError
        ? 'Add the amount and currency from the details above.'
        : null),
    amountError,
    /** Everything confirm needs is there — the button reads as ready. */
    ready: !!draft.walletId && !amountMissing,
    needsDetails,
    hasSubject: !!item.subject,
    setField,
    setType,
    setCategory,
    useLine,
    target,
    setTarget,
    pick,
    confirm,
    dismiss,
  }
}

export type ImportReview = ReturnType<typeof useImportReview>
