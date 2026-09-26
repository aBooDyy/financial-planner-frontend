import { useEffect, useMemo, useState } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { ParentCategorySelect } from '#/features/categories/components/ParentCategorySelect'
import { uniqueSlug } from '#/features/categories/data/slug'
import type { ResolvedCategory } from '#/features/categories/data/catalog'
import type { TxType } from '#/features/transactions/api/types'
import type { CategoryTarget } from '#/features/import/data/types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  raw: string
  /** The categories a new one can be filed under. */
  parents: ReadonlyArray<ResolvedCategory>
  /** Slugs already in use beside the new one — uniqueness is per sibling set. */
  takenSlugs: (parentId: string | null) => ReadonlyArray<string>
  onCreate: (target: CategoryTarget) => void
}

const FLOW_OPTIONS = [
  { value: 'spend', label: 'Money out' },
  { value: 'income', label: 'Money in' },
] as const

/**
 * Records a category to create at import time, under a slug unique among its siblings. Picking
 * a parent makes it a subcategory of that one, which is also where its type comes from.
 */
export function CreateCategoryDialog({
  open,
  onOpenChange,
  raw,
  parents,
  takenSlugs,
  onCreate,
}: Props) {
  const [name, setName] = useState(raw)
  const [type, setType] = useState<TxType>('spend')
  const [parentId, setParentId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(raw)
      setType('spend')
      setParentId(null)
    }
  }, [open, raw])

  const parent = useMemo(
    () => parents.find((candidate) => candidate.id === parentId) ?? null,
    [parents, parentId],
  )

  const trimmed = name.trim()

  const submit = () => {
    if (trimmed === '') return
    const slug = uniqueSlug(trimmed, takenSlugs(parent?.id ?? null))
    onCreate({
      kind: 'create',
      parentId: parent?.id ?? null,
      name: trimmed,
      type: parent ? parent.type : type,
      slug,
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New category"
      description="It is created when you import — nothing is written yet."
      contentClassName="sm:max-w-[440px]"
      footer={
        <DialogActions
          onCancel={() => onOpenChange(false)}
          submitLabel="Add category"
          disabled={trimmed === ''}
          onSubmit={submit}
        />
      }
    >
      <div>
        <FieldLabel htmlFor="new-category-name">Name</FieldLabel>
        <Input
          id="new-category-name"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div>
        <FieldLabel htmlFor="new-category-parent">
          Under which category?
        </FieldLabel>
        <ParentCategorySelect
          id="new-category-parent"
          value={parentId}
          options={parents}
          noneLabel="Nothing — a category of its own"
          onChange={(next) => setParentId(next?.id ?? null)}
        />
        <FieldMessage
          help={
            parent
              ? `A subcategory of ${parent.name}, so it files ${parent.type === 'spend' ? 'money out' : 'money in'} too.`
              : null
          }
        />
      </div>

      {parent === null ? (
        <div>
          <FieldLabel>What does it file?</FieldLabel>
          <PillSwitch<TxType>
            label="What this category files"
            options={FLOW_OPTIONS}
            value={type}
            onChange={setType}
          />
        </div>
      ) : null}
    </ResponsiveDialog>
  )
}
