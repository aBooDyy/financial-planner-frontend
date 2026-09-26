/**
 * The transaction dialog's wording and readiness rules: pure, so the dialog only renders them.
 */
import type { TransferWallet } from '#/features/wallets/data/transferDialog'
import type {
  ScopeOption,
  ScopeSection,
} from '#/features/transactions/data/selectors'
import type { EditorTxType } from '#/features/transactions/hooks/useTxEditor'
import { formatMoney, formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/** The type's tint, set on the dialog as `--tx-ink` / `--tx-soft`; income wears the accent. */
export const TYPE_TINT: Record<EditorTxType, { ink: string; soft: string }> = {
  spend: { ink: 'var(--fp-spend)', soft: 'var(--fp-spend-soft)' },
  income: { ink: 'var(--fp-accent-ink)', soft: 'var(--fp-accent-soft)' },
  transfer: { ink: 'var(--fp-transfer)', soft: 'var(--fp-transfer-soft)' },
}

/** The dialog's free-text note, on the shared `Input`. */
export const NOTE_INPUT =
  'rounded-[14px] border-[1.5px] border-fp-border px-[14px] py-[13px] text-[14px]'

export const TYPE_LABEL: Record<EditorTxType, string> = {
  spend: 'Spend',
  income: 'Income',
  transfer: 'Transfer',
}

export const AMOUNT_QUESTION: Record<EditorTxType, string> = {
  spend: 'How much did you spend?',
  income: 'How much came in?',
  transfer: 'How much are you moving?',
}

export const dialogTitle = (type: EditorTxType, editing: boolean): string =>
  editing ? `Edit ${type}` : 'New transaction'

export function submitLabel(args: {
  type: EditorTxType
  editing: boolean
  amountMinor: number | null
  currency: CurrencyCode
}): string {
  if (args.type !== 'transfer') return args.editing ? 'Save' : 'Add'
  return args.amountMinor !== null && args.amountMinor > 0
    ? `Save transfer · ${formatMoney(args.amountMinor, args.currency)}`
    : 'Save transfer'
}

/** What still stands between a spend or income entry and saving it, or null when it is ready. */
export function cashflowBlock(
  amountMinor: number | null,
  hasWallet: boolean,
): string | null {
  const hasAmount = amountMinor !== null && amountMinor > 0
  if (hasAmount && hasWallet) return null
  if (!hasAmount && !hasWallet) return 'Add an amount and a wallet'
  return hasAmount ? 'Pick a wallet first' : 'Add an amount to continue'
}

/** A transfer's same-account case speaks for itself next to the accounts. */
export function transferBlock(
  amountMinor: number | null,
  sameAccount: boolean,
): string | null {
  if (sameAccount) return null
  return amountMinor !== null && amountMinor > 0
    ? null
    : 'Add an amount to continue'
}

/**
 * The account tree an entry is filed under: the Spending filter's sections without "All
 * accounts", or a group with no wallet under it — an entry lands in one wallet — plus the
 * archived wallet an edited entry still uses.
 */
export function entryAccountSections(
  sections: ReadonlyArray<ScopeSection>,
  archivedInUse: TransferWallet | null,
): ScopeSection[] {
  const holdsWallet = (options: ScopeOption[], at: number): boolean => {
    const { depth } = options[at]
    for (let i = at + 1; i < options.length && options[i].depth > depth; i++)
      if (options[i].kind === 'wallet') return true
    return false
  }
  const out = sections
    .map((s) => ({
      ...s,
      options: s.options.filter(
        (o, i) =>
          o.kind === 'wallet' ||
          (o.kind === 'group' && holdsWallet(s.options, i)),
      ),
    }))
    .filter((s) => s.options.length > 0)
  if (!archivedInUse) return out
  const w = archivedInUse
  return [
    ...out,
    {
      label: 'Archived',
      options: [
        {
          value: `wallet:${w.id}`,
          kind: 'wallet',
          name: w.name,
          amountStr: formatMoneyRounded(w.balance, w.currency),
          color: w.color,
          icon: w.icon,
          depth: 0,
        },
      ],
    },
  ]
}
