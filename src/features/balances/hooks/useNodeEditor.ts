import { useState } from 'react'
import type { LocalBalanceNode } from '#/db/types'
import type { NodeKind } from '#/features/balances/api/types'
import { NODE_COLORS, ROOT_PARENT } from '#/features/balances/constants'
import {
  createNode,
  deleteNode,
  updateNode,
} from '#/features/balances/data/mutations'
import type { CurrencyCode } from '#/lib/currency'
import { minorToInputValue, parseAmountToMinor } from '#/lib/currency'
import { isIconId } from '#/lib/icons/catalog.gen'
import type { IconId } from '#/lib/icons/catalog.gen'

export type EditorDraft = {
  name: string
  amount: string
  currency: CurrencyCode
  color: string
  // `null` is a real choice: it means "use the default for this kind".
  icon: IconId | null
  note: string
  parentId: string
}

export type EditorState = {
  mode: NodeKind
  id: string | null
  draft: EditorDraft
}

export function useNodeEditor(defaultCurrency: CurrencyCode) {
  const [editing, setEditing] = useState<EditorState | null>(null)

  const openAdd = (mode: NodeKind, parentId: string | null = null) =>
    setEditing({
      mode,
      id: null,
      draft: {
        name: '',
        amount: '',
        currency: defaultCurrency,
        color: NODE_COLORS[0],
        icon: null,
        note: '',
        parentId: parentId ?? ROOT_PARENT,
      },
    })

  const openEdit = (node: LocalBalanceNode) =>
    setEditing({
      mode: node.kind,
      id: node.id,
      draft: {
        name: node.name,
        amount:
          node.amount !== null && node.currency !== null
            ? minorToInputValue(node.amount, node.currency)
            : '',
        currency: node.currency ?? defaultCurrency,
        color: node.color,
        icon: isIconId(node.icon) ? node.icon : null,
        note: node.note ?? '',
        parentId: node.parentId ?? ROOT_PARENT,
      },
    })

  const close = () => setEditing(null)

  const setField = <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) =>
    setEditing((prev) =>
      prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev,
    )

  const save = async () => {
    if (!editing) return
    const { mode, id, draft } = editing
    const parentId = draft.parentId === ROOT_PARENT ? null : draft.parentId
    const note = draft.note.trim() || null
    const isWallet = mode === 'wallet'
    const amount = isWallet
      ? (parseAmountToMinor(draft.amount, draft.currency) ?? 0)
      : null
    const currency = isWallet ? draft.currency : null

    if (id) {
      await updateNode(id, {
        name: draft.name.trim() || 'Untitled',
        color: draft.color,
        icon: draft.icon,
        note,
        parentId,
        amount: amount ?? undefined,
        currency: currency ?? undefined,
      })
    } else {
      await createNode({
        kind: mode,
        name: draft.name.trim() || (isWallet ? 'New wallet' : 'New group'),
        color: draft.color,
        icon: draft.icon,
        note,
        parentId,
        amount,
        currency,
      })
    }
    close()
  }

  const remove = async () => {
    if (!editing?.id) return
    await deleteNode(editing.id)
    close()
  }

  return { editing, openAdd, openEdit, close, setField, save, remove }
}
