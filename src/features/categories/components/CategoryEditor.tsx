import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { IconChip } from '#/components/icons/IconChip'
import { IconPicker } from '#/components/icons/IconPicker'
import { CAT_COLORS } from '#/features/categories/constants'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { CategoryEditor as Editor } from '#/features/categories/hooks/useCategoryEditor'
import { CATEGORY_ICON_FALLBACK, iconIdOr } from '#/lib/icons/fallbacks'
import { Segmented } from '#/features/settings/components/Segmented'

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'
const LOCKED = 'text-[13.5px] font-semibold text-fp-text'
const HINT = 'mt-[3px] text-[12px] text-fp-text-3'
const TOP_LEVEL = '__top__'

const TYPE_NAME = { spend: 'Spending', income: 'Income' } as const

type Props = {
  editor: Editor
  catalog: CategoryCatalog
}

/** Name, colour and icon for a category or a subcategory; parent and type only on create. */
export function CategoryEditor({ editor, catalog }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { editing } = editor
  if (editing === null) return null

  const { mode, type, draft } = editing
  const parent = catalog.all.find((c) => c.id === draft.parentId) ?? null
  const isCreate = mode === 'create'
  const preview = iconIdOr(
    draft.icon,
    parent?.icon ?? CATEGORY_ICON_FALLBACK[type],
  )
  const noun = draft.parentId ? 'subcategory' : 'category'

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) editor.close()
      }}
      title={`${isCreate ? 'New' : 'Edit'} ${noun}`}
      contentClassName="sm:max-w-[440px]"
      footer={
        <>
          <div className="flex-1" />
          <Button variant="outline" onClick={editor.close}>
            Cancel
          </Button>
          <Button onClick={editor.save} disabled={draft.name.trim() === ''}>
            {isCreate ? `Add ${noun}` : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Change icon"
            onClick={() => setPickerOpen(true)}
            className="rounded-[14px] ring-offset-2 ring-offset-fp-surface transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:outline-none"
          >
            <IconChip
              id={preview}
              color={draft.color}
              size={56}
              iconSize={28}
              className="rounded-[14px]"
            />
          </button>
        </div>

        <div>
          <Label className={LABEL}>Name</Label>
          <Input
            value={draft.name}
            autoFocus
            onChange={(e) => editor.setField('name', e.target.value)}
            placeholder={draft.parentId ? 'e.g. Cafés' : 'e.g. Groceries'}
          />
        </div>

        <div>
          <Label className={LABEL}>Colour</Label>
          <div className="flex flex-wrap gap-[10px]">
            {CAT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use colour ${color}`}
                onClick={() => editor.setField('color', color)}
                className="h-[27px] w-[27px] rounded-[8px] ring-1 ring-black/10"
                style={{
                  background: color,
                  outline:
                    draft.color === color
                      ? '2px solid var(--fp-text)'
                      : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <Label className={LABEL}>Type</Label>
          {isCreate && parent === null ? (
            <Segmented
              value={type}
              options={[
                { value: 'spend', label: 'Spending' },
                { value: 'income', label: 'Income' },
              ]}
              onChange={editor.setType}
            />
          ) : (
            <>
              <div className={LOCKED}>{TYPE_NAME[type]}</div>
              {isCreate ? null : (
                <p className={HINT}>Set when the category was created.</p>
              )}
            </>
          )}
        </div>

        <div>
          <Label className={LABEL}>In</Label>
          {isCreate ? (
            <Select
              value={draft.parentId ?? TOP_LEVEL}
              onValueChange={(v) =>
                editor.setParent(
                  v === TOP_LEVEL
                    ? null
                    : (catalog.all.find((c) => c.id === v) ?? null),
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOP_LEVEL}>— Top level —</SelectItem>
                {catalog.byType(type).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <div className={LOCKED}>
                {parent ? parent.name : '— Top level —'}
              </div>
              {parent ? (
                <p className={HINT}>
                  A subcategory can&rsquo;t be moved; delete it and add it where
                  you want it.
                </p>
              ) : null}
            </>
          )}
        </div>
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
