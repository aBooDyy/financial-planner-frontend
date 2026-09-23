import { useEffect, useMemo, useState } from 'react'
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
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { slugify } from '#/features/categories/data/slug'
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

const LABEL = 'mb-[6px] block text-[12px] font-semibold text-fp-text-2'
const TOP_LEVEL = '__top__'

const uniqueSlug = (name: string, taken: ReadonlyArray<string>): string => {
  const base = slugify(name)
  if (!taken.includes(base)) return base
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}_${suffix}`
    if (!taken.includes(candidate)) return candidate
  }
  return `${base}_${crypto.randomUUID().slice(0, 6)}`
}

/**
 * Records a category to create at import time, under the slugs its rows will carry. Picking
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
      category: parent ? parent.slug : slug,
      subcategory: parent ? slug : null,
      parentId: parent?.id ?? null,
      name: trimmed,
      type: parent ? parent.type : type,
    })
    onOpenChange(false)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New category"
      description="It is created when you import — nothing is written yet."
      footer={
        <>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={trimmed === ''} onClick={submit}>
            Add category
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[15px]">
        <div>
          <Label className={LABEL} htmlFor="new-category-name">
            Name
          </Label>
          <Input
            id="new-category-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <Label className={LABEL} htmlFor="new-category-parent">
            Under which category?
          </Label>
          <Select
            value={parentId ?? TOP_LEVEL}
            onValueChange={(value) =>
              setParentId(value === TOP_LEVEL ? null : value)
            }
          >
            <SelectTrigger id="new-category-parent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOP_LEVEL}>
                Nothing — a category of its own
              </SelectItem>
              {parents.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {parent === null ? (
          <div>
            <Label className={LABEL}>What it files</Label>
            <ToggleGroup
              type="single"
              value={type}
              spacing={1}
              aria-label="What this category files"
              className="w-full rounded-xl bg-fp-surface-2 p-1"
              onValueChange={(value) => {
                if (value) setType(value as TxType)
              }}
            >
              <ToggleGroupItem value="spend" className="flex-1 rounded-[9px]">
                Money out
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="flex-1 rounded-[9px]">
                Money in
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        ) : (
          <p className="text-[12px] text-fp-text-3">
            A subcategory of {parent.name}, so it files{' '}
            {parent.type === 'spend' ? 'money out' : 'money in'} too.
          </p>
        )}
      </div>
    </ResponsiveDialog>
  )
}
