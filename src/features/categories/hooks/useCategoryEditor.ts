import { useState } from 'react'
import { db } from '#/db/db'
import { CAT_COLORS } from '#/features/categories/constants'
import {
  createCategory,
  updateCategory,
} from '#/features/categories/data/mutations'
import type { TxType } from '#/features/transactions/api/types'
import { isIconId } from '#/lib/icons/catalog.gen'
import type { IconId } from '#/lib/icons/catalog.gen'

export type CategoryEditorDraft = {
  name: string
  color: string
  icon: IconId | null
  /** Writable on create only — a category never moves between parents (ADR-5). */
  parentId: string | null
}

export type CategoryEditorState = {
  mode: 'create' | 'edit'
  id: string | null
  type: TxType
  draft: CategoryEditorDraft
}

export type CategoryEditor = {
  editing: CategoryEditorState | null
  openCreate: (parentId: string | null) => void
  openEdit: (id: string) => void
  close: () => void
  setField: <TKey extends keyof CategoryEditorDraft>(
    field: TKey,
    value: CategoryEditorDraft[TKey],
  ) => void
  /** Picking a parent on create adopts its type; `null` returns to the top level. */
  setParent: (parent: { id: string; type: TxType } | null) => void
  setType: (type: TxType) => void
  save: () => void
}

/**
 * The category editor's draft and its two write paths. `type` is derived, never edited after
 * creation, and a chosen parent always wins — the server decides it the same way on create.
 */
export function useCategoryEditor(
  type: TxType,
  colorSeed: number,
): CategoryEditor {
  const [editing, setEditing] = useState<CategoryEditorState | null>(null)

  const openCreate = (parentId: string | null) =>
    void (async () => {
      const parent = parentId ? await db.categories.get(parentId) : undefined
      setEditing({
        mode: 'create',
        id: null,
        type: parent?.type ?? type,
        draft: {
          name: '',
          color: parent?.color ?? CAT_COLORS[colorSeed % CAT_COLORS.length],
          icon: null,
          parentId: parent?.id ?? null,
        },
      })
    })()

  const openEdit = (id: string) =>
    void (async () => {
      const row = await db.categories.get(id)
      if (!row) return
      setEditing({
        mode: 'edit',
        id: row.id,
        type: row.type,
        draft: {
          name: row.name,
          color: row.color,
          icon: isIconId(row.icon) ? row.icon : null,
          parentId: row.parentId,
        },
      })
    })()

  const setField: CategoryEditor['setField'] = (field, value) =>
    setEditing((prev) =>
      prev === null
        ? prev
        : { ...prev, draft: { ...prev.draft, [field]: value } },
    )

  const setParent: CategoryEditor['setParent'] = (parent) =>
    setEditing((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            type: parent?.type ?? prev.type,
            draft: { ...prev.draft, parentId: parent?.id ?? null },
          },
    )

  const setType = (next: TxType) =>
    setEditing((prev) => (prev === null ? prev : { ...prev, type: next }))

  const save = () => {
    if (editing === null) return
    const name = editing.draft.name.trim()
    if (!name) return
    const { id, mode, draft } = editing
    if (mode === 'edit' && id) {
      void updateCategory(id, {
        name,
        color: draft.color,
        icon: draft.icon,
      })
    } else {
      void createCategory({
        name,
        type: editing.type,
        color: draft.color,
        parentId: draft.parentId,
        icon: draft.icon,
      })
    }
    setEditing(null)
  }

  return {
    editing,
    openCreate,
    openEdit,
    close: () => setEditing(null),
    setField,
    setParent,
    setType,
    save,
  }
}
