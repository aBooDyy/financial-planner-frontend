import { buildTree, indexTree } from './payloadTree'
import type { PayloadNode } from './payloadTree'

/** A string in a JSON payload that a text rule could read as its message. */
export type MessageField = { path: string; text: string }

const MESSAGE_FIELDS_MAX = 20

const hasText = (node: PayloadNode): node is PayloadNode & { value: string } =>
  node.kind === 'string' && (node.value as string).trim() !== ''

/**
 * The payload's strings, likeliest message first: one holding a number (an amount, say), then
 * the longest.
 */
export function messageFields(value: unknown): MessageField[] {
  const found: MessageField[] = []
  const visit = (node: PayloadNode) => {
    if (hasText(node)) found.push({ path: node.path, text: node.value })
    node.children.forEach(visit)
  }
  visit(buildTree(value))
  const numbered = (field: MessageField) => (/\d/.test(field.text) ? 1 : 0)
  return found
    .sort((a, b) => numbered(b) - numbered(a) || b.text.length - a.text.length)
    .slice(0, MESSAGE_FIELDS_MAX)
}

/** The text at `path`, or null when the payload holds none there. */
export function messageAt(value: unknown, path: string): string | null {
  const node = indexTree(buildTree(value)).get(path)
  return node && hasText(node) ? node.value : null
}
