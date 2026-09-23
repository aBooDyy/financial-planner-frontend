import type { IntegrationRule } from '#/features/integrations/api/ruleTypes'
import { indexTree, tokenId } from './payloadTree'
import type { PayloadNode } from './payloadTree'
import { FIELD_META, FIELD_ORDER } from './ruleFields'

/** The span of `text` a pattern's first group captures, as JavaScript reads it. */
function capturedSpan(pattern: string, text: string): [number, number] | null {
  try {
    const found = new RegExp(pattern, 'd').exec(text)
    const span = found?.indices?.[1] ?? found?.indices?.[0]
    return span ? [span[0], span[1]] : null
  } catch {
    return null
  }
}

/**
 * Which labels to show beside each node and each word of the sample: a field's label on the
 * value its path reaches, and — when a pattern reads part of a string — on the words it keeps,
 * so every tap's effect is visible where it was made.
 */
export function treeMarks(
  rule: Pick<IntegrationRule, 'fields' | 'match'>,
  tree: PayloadNode | null,
): Map<string, string[]> {
  const marks = new Map<string, string[]>()
  const add = (id: string, label: string) =>
    marks.set(id, [...(marks.get(id) ?? []), label])
  const nodes = tree ? indexTree(tree) : new Map<string, PayloadNode>()

  for (const field of FIELD_ORDER) {
    const locator = rule.fields[field]
    const path = locator?.path?.trim()
    if (!path) continue
    const label = FIELD_META[field].label
    const node = nodes.get(path)
    const span =
      node && locator?.regex && typeof node.value === 'string'
        ? capturedSpan(locator.regex, node.value)
        : null
    if (!node || !span || node.tokens.length === 0) {
      add(path, label)
      continue
    }
    node.tokens.forEach((token, i) => {
      if (token.start < span[1] && token.end > span[0]) {
        add(tokenId(path, i), label)
      }
    })
  }
  const matchPath = rule.match?.path.trim()
  if (matchPath) add(matchPath, 'Condition')
  return marks
}
