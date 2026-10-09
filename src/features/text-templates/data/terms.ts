/** The longest word or phrase a rule's filter may hold. */
export const TERM_MAX = 100

/** Terms typed into a list: trimmed, capped, empties and repeats dropped. */
export function cleanTerms(terms: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of terms) {
    const term = raw.trim().slice(0, TERM_MAX)
    const folded = term.toLowerCase()
    if (!term || seen.has(folded)) continue
    seen.add(folded)
    out.push(term)
  }
  return out
}
