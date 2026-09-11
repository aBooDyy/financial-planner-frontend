import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import type { CategoryView } from '#/features/settings/hooks/useCategories'

export const CAT_COLORS = [
  '#1F9D6B',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#EF4444',
  '#14B8A6',
  '#64748B',
]

const ICON_BTN =
  'h-[30px] w-[30px] rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2'

type Props = {
  category: CategoryView
  onSave: (patch: { name: string; color: string }) => void
  onDelete: () => void
  last?: boolean
}

export function CategoryRow({ category, onSave, onDelete, last }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [color, setColor] = useState(category.color)

  const start = () => {
    setName(category.name)
    setColor(category.color)
    setEditing(true)
  }
  const commit = () => {
    if (name.trim()) onSave({ name: name.trim(), color })
    setEditing(false)
  }
  const cycleColor = () => {
    const i = CAT_COLORS.indexOf(color)
    setColor(CAT_COLORS[(i + 1) % CAT_COLORS.length])
  }

  return (
    <div
      className={`flex items-center gap-3 px-[18px] py-[13px] ${
        last ? '' : 'border-b border-fp-border'
      }`}
    >
      <button
        type="button"
        onClick={editing ? cycleColor : undefined}
        aria-label={editing ? 'Change color' : undefined}
        className="h-3 w-3 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
        style={{ background: color, cursor: editing ? 'pointer' : 'default' }}
      />

      {editing ? (
        <Input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="min-w-0 flex-1 rounded-[9px] border-fp-border-strong px-2.5 py-1.5 text-[14.5px] font-semibold"
        />
      ) : (
        <>
          <span className="text-[14.5px] font-semibold">{category.name}</span>
          <span className="rounded-full border border-fp-border bg-fp-surface-2 px-[9px] py-0.5 text-[12px] text-fp-text-3">
            {category.txCount} tx
          </span>
          <div className="flex-1" />
        </>
      )}

      {editing ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={commit}
            title="Save"
            className={`${ICON_BTN} hover:text-fp-accent-ink`}
          >
            <Check size={16} strokeWidth={2} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEditing(false)}
            title="Cancel"
            className={ICON_BTN}
          >
            <X size={16} strokeWidth={2} />
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={start}
            title="Edit"
            className={`${ICON_BTN} hover:text-fp-text`}
          >
            <Pencil size={15} strokeWidth={1.8} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            title="Delete"
            className={`${ICON_BTN} hover:text-fp-danger`}
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </Button>
        </>
      )}
    </div>
  )
}
