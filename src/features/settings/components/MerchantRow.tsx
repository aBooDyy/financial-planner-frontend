import { useState } from 'react'
import { Check, ChevronDown, Merge, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { IconChip } from '#/components/icons/IconChip'
import { useCategoryCatalog } from '#/features/categories/hooks/useCategoryCatalog'
import type { MerchantView } from '#/features/merchants/hooks/useMerchants'

const ICON_BTN =
  'h-[30px] w-[30px] rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2'
const PILL =
  'rounded-full border border-fp-border bg-fp-surface-2 px-[9px] py-0.5 text-[12px] text-fp-text-3'

type Props = {
  merchant: MerchantView
  onRename: (name: string) => void
  onAutoCategorize: (on: boolean) => void
  onRemoveAlias: (aliasId: string) => void
  onMerge: () => void
  onDelete: () => void
  last?: boolean
}

export function MerchantRow({
  merchant,
  onRename,
  onAutoCategorize,
  onRemoveAlias,
  onMerge,
  onDelete,
  last,
}: Props) {
  const catalog = useCategoryCatalog()
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(merchant.displayName)

  const learned = merchant.learnedCategory
    ? catalog.get(merchant.learnedCategory)
    : null

  const start = () => {
    setName(merchant.displayName)
    setEditing(true)
  }
  const commit = () => {
    if (name.trim()) onRename(name.trim())
    setEditing(false)
  }

  return (
    <div className={last ? '' : 'border-b border-fp-border'}>
      <div className="flex items-center gap-2 px-[18px] py-[13px]">
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
            <span className="min-w-0 truncate text-[14.5px] font-semibold">
              {merchant.displayName}
            </span>
            <span className={PILL}>{merchant.timesSeen}× seen</span>
            {merchant.txCount > 0 ? (
              <span className={PILL}>{merchant.txCount} tx</span>
            ) : null}
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
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              title={`${merchant.aliases.length} spellings`}
              className={`${ICON_BTN} hover:text-fp-text`}
            >
              <ChevronDown
                size={16}
                strokeWidth={1.8}
                className={open ? 'rotate-180 transition' : 'transition'}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={start}
              title="Rename"
              className={`${ICON_BTN} hover:text-fp-text`}
            >
              <Pencil size={15} strokeWidth={1.8} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMerge}
              title="Merge into another merchant"
              className={`${ICON_BTN} hover:text-fp-text`}
            >
              <Merge size={15} strokeWidth={1.8} />
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

      {open ? (
        <div className="flex flex-col gap-3 border-t border-fp-border bg-fp-surface-2 px-[18px] py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] font-semibold text-fp-text-2">
              Recognised as
            </span>
            {merchant.aliases.map((alias) => (
              <span
                key={alias.id}
                className="inline-flex items-center gap-1 rounded-full border border-fp-border bg-fp-surface px-[9px] py-[3px] text-[12px] text-fp-text-2"
              >
                <span className="max-w-[190px] truncate">
                  {alias.rawSample ?? alias.normalizedKey}
                </span>
                {merchant.aliases.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onRemoveAlias(alias.id)}
                    aria-label={`Forget ${alias.rawSample ?? alias.normalizedKey}`}
                    className="text-fp-text-3 hover:text-fp-danger"
                  >
                    <X size={12} strokeWidth={2.2} />
                  </button>
                ) : null}
              </span>
            ))}
          </div>

          {learned ? (
            <label className="flex items-center gap-[11px] text-start">
              <Switch
                checked={merchant.autoCategorize}
                onCheckedChange={onAutoCategorize}
                className="flex-none"
              />
              <span className="inline-flex flex-wrap items-center gap-[5px] text-[12.5px] text-fp-text-2">
                File as
                <IconChip
                  id={learned.icon}
                  color={learned.color}
                  size={22}
                  iconSize={13}
                />
                <span className="font-semibold text-fp-text">
                  {learned.name}
                </span>
                automatically
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
