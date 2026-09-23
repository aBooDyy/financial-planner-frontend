import { CHECK_MATCH_SCORE, identityKey, scoreKeys } from './matching'
import type { LocalMerchant, LocalMerchantAlias } from '#/db/types'
import type { MerchantIndex } from './matching'

/**
 * Which merchants look like the same shop written twice.
 *
 * A bulk import is where this bites: a statement spells one shop a dozen ways, each branch
 * code becomes its own row, and the matcher can only bind what it is confident about at map
 * time. What is left is a list nobody wants to read, so the cleanup has to be offered rather
 * than waited for.
 *
 * The bar is `CHECK_MATCH_SCORE` — the same score the importer treats as "close enough to
 * ask about". Nothing here merges anything: a suggestion is a question, and the merge itself
 * is the user's click on a dialog that says what it will do.
 */

export type MergeSuggestion = {
  /** The row that would disappear — always the less-seen of the pair. */
  source: LocalMerchant
  target: LocalMerchant
  score: number
  /** The two spellings that scored, for the sentence the card shows. */
  sourceSpelling: string
  targetSpelling: string
}

/** Enough to act on in one sitting; a longer list reads as a chore, not a nudge. */
export const MAX_SUGGESTIONS = 8

const keysOf = (
  merchant: LocalMerchant,
  aliases: ReadonlyArray<LocalMerchantAlias>,
): Array<{ key: string; spelling: string }> => {
  const seen = new Map<string, string>()
  const add = (key: string, spelling: string) => {
    if (key && !seen.has(key)) seen.set(key, spelling)
  }
  add(identityKey(merchant.displayName), merchant.displayName)
  for (const alias of aliases) {
    if (alias.merchantId !== merchant.id || alias.deleted === 1) continue
    add(alias.normalizedKey, alias.rawSample ?? alias.normalizedKey)
  }
  return [...seen].map(([key, spelling]) => ({ key, spelling }))
}

type Pair = { score: number; left: string; right: string }

const bestPair = (
  left: ReturnType<typeof keysOf>,
  right: ReturnType<typeof keysOf>,
): Pair => {
  let best: Pair = { score: 0, left: '', right: '' }
  for (const a of left) {
    for (const b of right) {
      const score = a.key === b.key ? 100 : scoreKeys(a.key, b.key)
      if (score > best.score) {
        best = { score, left: a.spelling, right: b.spelling }
      }
    }
  }
  return best
}

/** The one that keeps its name: seen most often, ties by name so the order is stable. */
const survivorFirst = (
  a: LocalMerchant,
  b: LocalMerchant,
): [LocalMerchant, LocalMerchant] =>
  b.timesSeen > a.timesSeen ||
  (b.timesSeen === a.timesSeen &&
    b.displayName.localeCompare(a.displayName) < 0)
    ? [b, a]
    : [a, b]

const WORD = /^[a-z]{3,}$/

/**
 * Only merchants that share a real word are ever compared. It keeps the pass linear in
 * practice on a list a bulk import has blown up, and the exclusion is the point as much as
 * the speed: a shared *number* is a branch code, and two shops that agree on nothing but
 * `402` are not the same shop.
 */
const candidatePairs = (
  live: ReadonlyArray<LocalMerchant>,
  keys: ReadonlyMap<string, ReturnType<typeof keysOf>>,
): Array<[LocalMerchant, LocalMerchant]> => {
  const byWord = new Map<string, LocalMerchant[]>()
  for (const merchant of live) {
    const words = new Set<string>()
    for (const { key } of keys.get(merchant.id) ?? []) {
      for (const token of key.split(' ')) if (WORD.test(token)) words.add(token)
    }
    for (const word of words) {
      const bucket = byWord.get(word)
      if (bucket) bucket.push(merchant)
      else byWord.set(word, [merchant])
    }
  }

  const pairs = new Map<string, [LocalMerchant, LocalMerchant]>()
  for (const bucket of byWord.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const [a, b] =
          bucket[i].id < bucket[j].id
            ? [bucket[i], bucket[j]]
            : [bucket[j], bucket[i]]
        pairs.set(`${a.id}|${b.id}`, [a, b])
      }
    }
  }
  return [...pairs.values()]
}

export function mergeSuggestions(index: MerchantIndex): MergeSuggestion[] {
  const live = index.merchants.filter((m) => m.deleted === 0)
  if (live.length < 2) return []

  const keys = new Map(live.map((m) => [m.id, keysOf(m, index.aliases)]))
  const found: MergeSuggestion[] = []

  for (const [a, b] of candidatePairs(live, keys)) {
    const pair = bestPair(keys.get(a.id) ?? [], keys.get(b.id) ?? [])
    if (pair.score < CHECK_MATCH_SCORE) continue
    const [target, source] = survivorFirst(a, b)
    const targetIsA = target.id === a.id
    found.push({
      source,
      target,
      score: pair.score,
      sourceSpelling: targetIsA ? pair.right : pair.left,
      targetSpelling: targetIsA ? pair.left : pair.right,
    })
  }

  found.sort(
    (x, y) =>
      y.score - x.score ||
      y.target.timesSeen - x.target.timesSeen ||
      x.source.displayName.localeCompare(y.source.displayName),
  )

  // One suggestion per merchant: offering to fold a row into two different shops, or to
  // merge into a row that is itself about to disappear, is a chain nobody can reason about.
  const spoken = new Set<string>()
  const top: MergeSuggestion[] = []
  for (const suggestion of found) {
    if (spoken.has(suggestion.source.id) || spoken.has(suggestion.target.id)) {
      continue
    }
    spoken.add(suggestion.source.id)
    spoken.add(suggestion.target.id)
    top.push(suggestion)
    if (top.length === MAX_SUGGESTIONS) break
  }
  return top
}
