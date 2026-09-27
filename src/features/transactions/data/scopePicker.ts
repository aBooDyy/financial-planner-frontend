/**
 * The account filter's multi-select rules: pure, so the menu only renders them.
 */
import { formatMoneyRounded } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import type {
  FilterOption,
  Scope,
  ScopeOption,
  ScopeSection,
} from './selectors'
import { pickFromValue, pickValue, picksOf, scopeFromPicks } from './selectors'

/** For each option, the values of the groups it sits under, read off the tree's depths. */
export function ancestorValues(
  sections: ReadonlyArray<ScopeSection>,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const section of sections) {
    const trail: ScopeOption[] = []
    for (const option of section.options) {
      while (trail.length > 0 && trail[trail.length - 1].depth >= option.depth)
        trail.pop()
      out.set(
        option.value,
        trail.filter((o) => o.kind === 'group').map((o) => o.value),
      )
      trail.push(option)
    }
  }
  return out
}

/** Ticked through a ticked group above it, so it cannot be unticked on its own. */
export const isCovered = (
  scope: Scope,
  value: string,
  ancestors: ReadonlyMap<string, string[]>,
): boolean => {
  const picked = new Set(picksOf(scope).map(pickValue))
  return (ancestors.get(value) ?? []).some((v) => picked.has(v))
}

export const isPicked = (scope: Scope, value: string): boolean =>
  picksOf(scope).some((p) => pickValue(p) === value)

/**
 * Tick or untick one account. Ticking a group drops the picks beneath it — the group already
 * covers them. Unticking the last pick is everything again.
 */
export function togglePick(
  scope: Scope,
  value: string,
  ancestors: ReadonlyMap<string, string[]>,
): Scope {
  const pick = pickFromValue(value)
  if (!pick || isCovered(scope, value, ancestors)) return scope
  const picks = picksOf(scope)
  if (isPicked(scope, value))
    return scopeFromPicks(picks.filter((p) => pickValue(p) !== value))
  const outside = picks.filter(
    (p) => !(ancestors.get(pickValue(p)) ?? []).includes(value),
  )
  return scopeFromPicks([...outside, pick])
}

/** "All accounts", one account's name, "Main + Cash", or "3 accounts". */
export function scopeLabel(
  scope: Scope,
  sections: ReadonlyArray<ScopeSection>,
): string {
  if (scope.type === 'all') return 'All accounts'
  const names = new Map(
    sections.flatMap((s) => s.options.map((o) => [o.value, o.name] as const)),
  )
  const picked = picksOf(scope).map((p) => names.get(pickValue(p)) ?? '')
  if (picked.length <= 2) return picked.join(' + ')
  return `${picked.length} accounts`
}

/** Every live account's balance, in base. */
export const allAccountsMinor = (
  sections: ReadonlyArray<ScopeSection<FilterOption>>,
): number =>
  sections.flatMap((s) => s.options).find((o) => o.kind === 'all')?.baseMinor ??
  0

export type ScopeBalancePart = { name: string; amountStr: string }

export type ScopeBalance = {
  /** "All accounts", the one account's name, or "Total" over several. */
  label: string
  amountStr: string
  /** Each picked account's own balance, when the scope sums more than one. */
  parts: ScopeBalancePart[]
}

/** What the chosen accounts hold: one balance, or a base-currency total and its parts. */
export function scopeBalance(
  scope: Scope,
  sections: ReadonlyArray<ScopeSection<FilterOption>>,
  base: CurrencyCode,
): ScopeBalance {
  const byValue = new Map(
    sections.flatMap((s) => s.options.map((o) => [o.value, o] as const)),
  )
  if (scope.type === 'all') {
    const all = byValue.get('all')
    return { label: 'All accounts', amountStr: all?.amountStr ?? '', parts: [] }
  }
  const picked = picksOf(scope)
    .map((p) => byValue.get(pickValue(p)))
    .filter((o): o is FilterOption => o !== undefined)
  if (picked.length === 1)
    return { label: picked[0].name, amountStr: picked[0].amountStr, parts: [] }
  const total = picked.reduce((sum, o) => sum + o.baseMinor, 0)
  return {
    label: 'Total',
    amountStr: formatMoneyRounded(total, base),
    parts: picked.map((o) => ({ name: o.name, amountStr: o.amountStr })),
  }
}
