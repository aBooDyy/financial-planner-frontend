import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'

/** Whether a change is welcome: more income is, more spending is not. */
export type Tone = 'good' | 'bad' | 'neutral'

/**
 * A change against the comparison period: "▲ 12%", "No change", or — when the comparison had
 * nothing to measure against — `noBase` with "–%".
 */
export type Delta = { text: string; tone: Tone; noBase?: true }

export const NO_BASE: Delta = { text: '–%', tone: 'neutral', noBase: true }

/** Under one percent either way reads as no change at all. */
const FLAT_PCT = 1

export function pctDelta(
  cur: number,
  prev: number,
  goodWhenUp: boolean,
): Delta {
  if (prev === 0) return NO_BASE
  const pct = ((cur - prev) / prev) * 100
  if (Math.abs(pct) < FLAT_PCT) return { text: 'No change', tone: 'neutral' }
  const up = pct > 0
  return {
    text: `${up ? '▲' : '▼'} ${Math.round(Math.abs(pct))}%`,
    tone: up === goodWhenUp ? 'good' : 'bad',
  }
}

/** A change in money, e.g. net: "▲ SR 1,200", good when it rose. */
export function amountDelta(
  cur: number,
  prev: number,
  base: CurrencyCode,
): Delta {
  const diff = cur - prev
  if (diff === 0) return { text: 'No change', tone: 'neutral' }
  return {
    text: `${diff >= 0 ? '▲' : '▼'} ${formatMoneyRounded(Math.abs(diff), base)}`,
    tone: diff >= 0 ? 'good' : 'bad',
  }
}

/** "+SR 1,200" / "−SR 300". */
export const signedMoney = (amount: number, base: CurrencyCode): string =>
  `${amount >= 0 ? '+' : '−'}${formatMoneyRounded(Math.abs(amount), base)}`

/** "SR 1,200" / "−SR 300": a balance, which only shows its sign when negative. */
export const balanceMoney = (amount: number, base: CurrencyCode): string =>
  `${amount < 0 ? '−' : ''}${formatMoneyRounded(Math.abs(amount), base)}`
