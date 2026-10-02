/**
 * Add money's arithmetic (03 §3): what a split still has to place, and the over-commit
 * guardrail — a wallet asked to hold more than it has free is named, never silently allowed,
 * and the user may set it aside anyway (D31). Pure.
 */
import { convertMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type { RatesMap } from '#/lib/config/rates'
import { money } from './format'

/** One wallet's share, in the owner's currency. */
export type WalletPart = { walletId: string; amount: number }

/** What is left to place across a split (negative = placed too much). */
export const leftToPlace = (
  total: number,
  parts: ReadonlyArray<{ amount: number }>,
): number => total - parts.reduce((sum, p) => sum + p.amount, 0)

export type OverCommit = {
  walletId: string
  /** Wallet currency. */
  free: number
  wanted: number
  over: number
  currency: CurrencyCode
}

/** The wallets the parts would push past their free money, each summed once. */
export function overCommits(
  parts: ReadonlyArray<WalletPart>,
  ownerCurrency: CurrencyCode,
  wallets: ReadonlyMap<string, { free: number; currency: CurrencyCode }>,
  rates: RatesMap,
): OverCommit[] {
  const wanted = new Map<string, number>()
  for (const p of parts) {
    const wallet = wallets.get(p.walletId)
    if (!wallet || p.amount <= 0) continue
    wanted.set(
      p.walletId,
      (wanted.get(p.walletId) ?? 0) +
        convertMinor(p.amount, ownerCurrency, wallet.currency, rates),
    )
  }
  const out: OverCommit[] = []
  for (const [walletId, amount] of wanted) {
    const wallet = wallets.get(walletId)
    if (!wallet || amount <= wallet.free) continue
    out.push({
      walletId,
      free: wallet.free,
      wanted: amount,
      over: amount - Math.max(0, wallet.free),
      currency: wallet.currency,
    })
  }
  return out
}

/** "Main bank has SR 300 free. Setting aside SR 500 leaves it SR 200 over-committed." */
export function overCommitText(o: OverCommit, walletName: string): string {
  const free =
    o.free > 0
      ? `${walletName} has ${money(o.free, o.currency)} free.`
      : `${walletName} has nothing free.`
  return `${free} Setting aside ${money(o.wanted, o.currency)} leaves it ${money(o.over, o.currency)} over-committed.`
}
