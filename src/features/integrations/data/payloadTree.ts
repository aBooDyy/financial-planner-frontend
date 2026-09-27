import { tokenise } from '#/lib/wordTokens'
import type { Token } from '#/lib/wordTokens'

type SampleProblem = 'empty' | 'invalid' | 'not_object' | 'too_large'

export type SampleReading =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; problem: SampleProblem; detail?: string }

/** The sample as ingest would read it: bounded, JSON, an object at the root. */
export function readSample(text: string, maxBytes: number): SampleReading {
  if (!text.trim()) return { ok: false, problem: 'empty' }
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, problem: 'too_large' }
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      problem: 'invalid',
      detail: error instanceof Error ? error.message : undefined,
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, problem: 'not_object' }
  }
  return { ok: true, value: value as Record<string, unknown> }
}

// --- Paths ---------------------------------------------------------------------------

/** What the backend's path grammar accepts after a dot; anything else needs `["…"]`. */
const BARE_KEY = /^[^.[\]"'\\*()?\s]+$/u

const keySegment = (key: string): string =>
  BARE_KEY.test(key)
    ? `.${key}`
    : `["${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`

export const childPath = (parent: string, key: string | number): string =>
  typeof key === 'number' ? `${parent}[${key}]` : parent + keySegment(key)

// --- The tree ------------------------------------------------------------------------

export type NodeKind =
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'

export type PayloadNode = {
  /** The node's path — unique, so it doubles as the id. */
  path: string
  /** The key or `[index]` it sits under; `$` for the root. */
  label: string
  kind: NodeKind
  value: unknown
  depth: number
  parent: string | null
  children: PayloadNode[]
  /** A string long enough to hold several values gets tappable pieces. */
  tokens: Token[]
}

const kindOf = (value: unknown): NodeKind => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'object':
      return 'object'
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'null'
  }
}

export function buildTree(root: unknown): PayloadNode {
  const walk = (
    value: unknown,
    path: string,
    label: string,
    depth: number,
    parent: string | null,
  ): PayloadNode => {
    const kind = kindOf(value)
    const node: PayloadNode = {
      path,
      label,
      kind,
      value,
      depth,
      parent,
      children: [],
      tokens: [],
    }
    if (kind === 'object') {
      node.children = Object.entries(value as Record<string, unknown>).map(
        ([key, child]) =>
          walk(child, childPath(path, key), key, depth + 1, path),
      )
    } else if (kind === 'array') {
      node.children = (value as unknown[]).map((child, index) =>
        walk(child, childPath(path, index), `[${index}]`, depth + 1, path),
      )
    } else if (kind === 'string') {
      const tokens = tokenise(value as string)
      node.tokens = tokens.length > 1 ? tokens : []
    }
    return node
  }
  return walk(root, '$', '$', 0, null)
}

/** `*` cannot end a path in the grammar (it is not allowed in a bare key), so a token id
 *  never collides with a node's. */
export const tokenId = (path: string, index: number): string =>
  `${path}*${index}`

/** Every node by its path. */
export function indexTree(root: PayloadNode): Map<string, PayloadNode> {
  const byId = new Map<string, PayloadNode>()
  const visit = (node: PayloadNode) => {
    byId.set(node.path, node)
    node.children.forEach(visit)
  }
  visit(root)
  return byId
}

export const isExpandable = (node: PayloadNode): boolean =>
  node.children.length > 0 || node.tokens.length > 0

/** A string with more pieces than this starts collapsed; its pieces are one keypress away. */
const TOKENS_OPEN_MAX = 12
/** Containers deeper than this start collapsed, so a big payload opens readable. */
const DEPTH_OPEN_MAX = 3

export function initiallyExpanded(root: PayloadNode): Set<string> {
  const open = new Set<string>()
  const visit = (node: PayloadNode) => {
    if (node.children.length > 0 && node.depth < DEPTH_OPEN_MAX) {
      open.add(node.path)
    }
    if (node.tokens.length > 0 && node.tokens.length <= TOKENS_OPEN_MAX) {
      open.add(node.path)
    }
    node.children.forEach(visit)
  }
  visit(root)
  return open
}

/**
 * The ids a keyboard walks, top to bottom: open containers' children, open strings' pieces.
 * The root is always open and never listed — there is nothing to bind at `$` itself.
 */
export function visibleIds(root: PayloadNode, expanded: Set<string>): string[] {
  const ids: string[] = []
  const visit = (node: PayloadNode) => {
    ids.push(node.path)
    if (!expanded.has(node.path)) return
    node.children.forEach(visit)
    node.tokens.forEach((_, i) => ids.push(tokenId(node.path, i)))
  }
  root.children.forEach(visit)
  return ids
}

export const parseTokenId = (
  id: string,
): { path: string; index: number } | null => {
  const at = id.lastIndexOf('*')
  if (at === -1) return null
  const index = Number(id.slice(at + 1))
  return Number.isInteger(index) ? { path: id.slice(0, at), index } : null
}

/** A value as the tree prints it: strings quoted, containers summarised. */
export function preview(node: PayloadNode): string {
  switch (node.kind) {
    case 'object':
      return plural(node.children.length, 'key')
    case 'array':
      return plural(node.children.length, 'item')
    case 'string':
      return JSON.stringify(node.value)
    default:
      return String(node.value)
  }
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

const REFERENCE_KEY =
  /^(id|uuid|guid|ref|reference|txn_?id|transaction_?id|external_?id|event_?id|message_?id)$|(_id|Id|ID)$/

/** Leaves a person would plausibly call the transaction's reference. */
export function referenceCandidates(root: PayloadNode): string[] {
  const found: string[] = []
  const visit = (node: PayloadNode) => {
    const leaf = node.kind === 'string' || node.kind === 'number'
    if (leaf && node.parent !== null && REFERENCE_KEY.test(node.label)) {
      found.push(node.path)
    }
    node.children.forEach(visit)
  }
  visit(root)
  return found
}
