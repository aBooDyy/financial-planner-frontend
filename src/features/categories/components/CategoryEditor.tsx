import { useState } from 'react'
import { ColorSwatches } from '#/components/dialog/ColorSwatches'
import { DialogActions } from '#/components/dialog/DialogActions'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import { IconChip } from '#/components/icons/IconChip'
import { IconPicker } from '#/components/icons/IconPicker'
import { CAT_COLORS } from '#/features/categories/constants'
import type {
  CategoryCatalog,
  ResolvedCategory,
} from '#/features/categories/data/catalog'
import type {
  CategoryEditor as Editor,
  CategoryEditorState,
} from '#/features/categories/hooks/useCategoryEditor'
import type { TxType } from '#/features/transactions/api/types'
import { CATEGORY_ICON_FALLBACK, iconIdOr } from '#/lib/icons/fallbacks'
import { LockedField } from './LockedField'
import { ParentCategorySelect } from './ParentCategorySelect'

const TYPE_NAME = { spend: 'Spending', income: 'Income' } as const
const TYPE_OPTIONS = [
  { value: 'spend', label: 'Spending' },
  { value: 'income', label: 'Income' },
] as const
const TOP_LEVEL = 'Top level'

type Props = {
  editor: Editor
  catalog: CategoryCatalog
}

/** Name, colour and icon for a category or a subcategory; parent and type only on create. */
export function CategoryEditor({ editor, catalog }: Props) {
  if (editor.editing === null) return null
  return (
    <CategoryEditorForm
      editor={editor}
      editing={editor.editing}
      catalog={catalog}
    />
  )
}

/** Why Type and In can't change, said once under the pair. */
function lockedReason(isCreate: boolean, hasParent: boolean): string | null {
  if (isCreate) {
    return hasParent ? 'A subcategory takes its type from its parent.' : null
  }
  return hasParent
    ? 'Type is set when it’s created, and a subcategory can’t be moved — delete it and add it where you want it.'
    : 'Type is set when the category is created.'
}

function CategoryEditorForm({
  editor,
  editing,
  catalog,
}: Props & { editing: CategoryEditorState }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [attempted, setAttempted] = useState(false)

  const { mode, type, draft } = editing
  const parent = catalog.all.find((c) => c.id === draft.parentId) ?? null
  const isCreate = mode === 'create'
  const preview = iconIdOr(
    draft.icon,
    parent?.icon ?? CATEGORY_ICON_FALLBACK[type],
  )
  const noun = draft.parentId ? 'subcategory' : 'category'
  const named = draft.name.trim() !== ''
  const nameMissing = attempted && !named

  const submit = () => {
    if (named) editor.save()
    else setAttempted(true)
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) editor.close()
      }}
      title={`${isCreate ? 'New' : 'Edit'} ${noun}`}
      contentClassName="sm:max-w-[440px]"
      footer={
        <DialogActions
          onCancel={editor.close}
          submitLabel={isCreate ? `Add ${noun}` : 'Save'}
          ready={named}
          onSubmit={submit}
        />
      }
    >
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-[14px]">
        <button
          type="button"
          aria-label="Change icon"
          onClick={() => setPickerOpen(true)}
          className="group flex flex-col items-center gap-[5px] rounded-[17px] outline-none focus-visible:ring-[3px] focus-visible:ring-fp-accent/30"
        >
          <IconChip
            id={preview}
            color={draft.color}
            size={56}
            iconSize={26}
            className="rounded-[17px] transition group-hover:brightness-95"
          />
          <span className="text-[11.5px] font-bold text-fp-accent-ink">
            Change
          </span>
        </button>
        <div className="min-w-0">
          <FieldLabel htmlFor="category-name">Name</FieldLabel>
          <Input
            id="category-name"
            value={draft.name}
            autoFocus
            aria-invalid={nameMissing || undefined}
            onChange={(e) => editor.setField('name', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            placeholder={draft.parentId ? 'e.g. Cafés' : 'e.g. Groceries'}
          />
          <FieldMessage error={nameMissing ? 'Give it a name.' : null} />
        </div>
      </div>

      <div>
        <FieldLabel>Colour</FieldLabel>
        <ColorSwatches
          label="Colour"
          colors={CAT_COLORS}
          value={draft.color}
          onChange={(color) => editor.setField('color', color)}
        />
      </div>

      <div>
        <div className="grid grid-cols-2 items-start gap-3">
          <div className="min-w-0">
            <FieldLabel>Type</FieldLabel>
            {isCreate && parent === null ? (
              <PillSwitch<TxType>
                label="Type"
                options={TYPE_OPTIONS}
                value={type}
                onChange={editor.setType}
              />
            ) : (
              <LockedField label="Type">{TYPE_NAME[type]}</LockedField>
            )}
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor={isCreate ? 'category-parent' : undefined}>
              In
            </FieldLabel>
            {isCreate ? (
              <ParentCategorySelect
                id="category-parent"
                value={draft.parentId}
                options={catalog.byType(type)}
                noneLabel={TOP_LEVEL}
                onChange={editor.setParent}
              />
            ) : (
              <LockedParent parent={parent} />
            )}
          </div>
        </div>
        <FieldMessage help={lockedReason(isCreate, parent !== null)} />
      </div>

      <IconPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={draft.icon}
        color={draft.color}
        onSelect={(id) => editor.setField('icon', id)}
      />
    </ResponsiveDialog>
  )
}

function LockedParent({ parent }: { parent: ResolvedCategory | null }) {
  return (
    <LockedField
      label="In"
      leading={
        parent ? (
          <IconChip
            id={parent.icon}
            color={parent.color}
            size={22}
            iconSize={13}
            className="rounded-[7px]"
          />
        ) : undefined
      }
    >
      {parent ? parent.name : TOP_LEVEL}
    </LockedField>
  )
}
