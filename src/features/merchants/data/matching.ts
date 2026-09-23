import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'

/**
 * The client half of merchant identity: the port of the backend's `normalize_key` plus the
 * scored ladder that binds a raw spelling to a merchant we already know.
 *
 * `normalizeKey` is pinned to `__fixtures__/normalize_key_cases.json`, the same table the
 * Python suite asserts. Change one without the other and the two normalisers drift, which
 * means the server stores an identity the client can never match again.
 */

const NON_ALNUM = /[^a-z0-9]+/g

/** The alias column is `String(200)`; a longer proposal is a different merchant, not a cut one. */
export const MAX_ALIAS_LENGTH = 200

const MAX_KEY_LENGTH = 120

/**
 * Lowercase → every run outside `[a-z0-9]` becomes one space → trim → first 120 chars.
 * Digits are kept deliberately: `carrefour 402` and `carrefour 118` are different branches
 * and must never collapse into one row.
 */
export const normalizeKey = (raw: string): string =>
  raw.toLowerCase().replace(NON_ALNUM, ' ').trim().slice(0, MAX_KEY_LENGTH)

/**
 * The key to store and compare with. Truncation happens after the trim, so a key longer than
 * 120 characters can end in a space that the server's re-normalisation strips — applying the
 * function twice reaches the fixed point the server will actually hold.
 */
export const identityKey = (raw: string): string =>
  normalizeKey(normalizeKey(raw))

// --- The scored ladder ---------------------------------------------------------------

/** At or above this a match is applied automatically and marked `✓ auto`. */
export const AUTO_MATCH_SCORE = 70
/** At or above this a match is pre-selected but flagged for the user to check. */
export const CHECK_MATCH_SCORE = 40

export type MerchantMatch = {
  merchant: LocalMerchant
  score: number
  /** The alias that produced an exact hit, when one did. */
  alias: LocalMerchantAlias | null
}

const tokensOf = (key: string): string[] => (key ? key.split(' ') : [])

/** True when `outer` contains `inner` as a whole-token run, not a mid-token substring. */
const containsTokenRun = (outer: string, inner: string): boolean =>
  inner.length > 0 &&
  outer.length > inner.length &&
  ` ${outer} `.includes(` ${inner} `)

const jaccard = (a: string[], b: string[]): number => {
  const left = new Set(a)
  const right = new Set(b)
  let shared = 0
  for (const token of left) if (right.has(token)) shared += 1
  const union = left.size + right.size - shared
  return union === 0 ? 0 : shared / union
}

const levenshtein = (a: string, b: string): number => {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
    }
    previous = current
  }
  return previous[b.length]
}

const SHORT_STRING = 16
const CLOSE_ENOUGH = 0.82

const similarity = (a: string, b: string): number => {
  const longest = Math.max(a.length, b.length)
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest
}

/**
 * Score one candidate key against the query key. Exact equality is the caller's business —
 * an exact alias hit short-circuits at 100 before this is reached.
 */
export function scoreKeys(queryKey: string, candidateKey: string): number {
  if (!queryKey || !candidateKey) return 0
  if (queryKey === candidateKey) return 100
  if (
    containsTokenRun(queryKey, candidateKey) ||
    containsTokenRun(candidateKey, queryKey)
  ) {
    return 70
  }
  const queryTokens = tokensOf(queryKey)
  const candidateTokens = tokensOf(candidateKey)
  if (queryTokens.length >= 2 && candidateTokens.length >= 2) {
    const overlap = jaccard(queryTokens, candidateTokens)
    if (overlap > 0) {
      return Math.min(69, CHECK_MATCH_SCORE + Math.round(overlap * 29))
    }
  }
  if (
    queryKey.length <= SHORT_STRING &&
    candidateKey.length <= SHORT_STRING &&
    similarity(queryKey, candidateKey) >= CLOSE_ENOUGH
  ) {
    return 60
  }
  return 0
}

export type MerchantIndex = {
  merchants: LocalMerchant[]
  aliases: LocalMerchantAlias[]
}

/**
 * Best merchant for a raw spelling. An exact hit on a stored **alias** wins outright — that
 * is the whole point of a merchant carrying many identifiers.
 */
export function matchMerchant(
  raw: string,
  index: MerchantIndex,
): MerchantMatch | null {
  const key = identityKey(raw)
  if (!key) return null

  const live = index.merchants.filter((m) => m.deleted === 0)
  const byId = new Map(live.map((m) => [m.id, m]))

  for (const alias of index.aliases) {
    if (alias.deleted === 1 || alias.normalizedKey !== key) continue
    const merchant = byId.get(alias.merchantId)
    if (merchant) return { merchant, score: 100, alias }
  }

  const aliasesByMerchant = new Map<string, LocalMerchantAlias[]>()
  for (const alias of index.aliases) {
    if (alias.deleted === 1) continue
    const list = aliasesByMerchant.get(alias.merchantId)
    if (list) list.push(alias)
    else aliasesByMerchant.set(alias.merchantId, [alias])
  }

  let best: MerchantMatch | null = null
  for (const merchant of live) {
    const candidates = [
      identityKey(merchant.displayName),
      ...(aliasesByMerchant.get(merchant.id) ?? []).map((a) => a.normalizedKey),
    ]
    let score = 0
    for (const candidate of candidates) {
      score = Math.max(score, scoreKeys(key, candidate))
    }
    // Ties keep the merchant seen most often — the noisy one-off loses to the real shop.
    const better =
      score > (best?.score ?? 0) ||
      (best !== null &&
        score === best.score &&
        merchant.timesSeen > best.merchant.timesSeen)
    if (score > 0 && better) best = { merchant, score, alias: null }
  }
  return best
}
