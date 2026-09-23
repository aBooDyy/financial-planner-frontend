import { useState } from 'react'
import { Check, ChevronDown, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { formatDate, formatRelativeTime, parseISODate } from '#/lib/date'
import { useDirectionStore } from '#/stores/direction'
import { usePreferencesStore } from '#/stores/preferences'
import type { LocalImportTemplate } from '#/db/types'

const ICON_BTN =
  'h-[30px] w-[30px] rounded-[9px] text-fp-text-3 hover:bg-fp-surface-2'
const PILL =
  'rounded-full border border-fp-border bg-fp-surface-2 px-[9px] py-0.5 text-[12px] text-fp-text-3'

type Props = {
  template: LocalImportTemplate
  /** The file values this mapping answers for — what "see aliases" shows. */
  answers: ReadonlyArray<string>
  onRename: (name: string) => void
  onDelete: () => void
  last?: boolean
}

export function ImportTemplateRow({
  template,
  answers,
  onRename,
  onDelete,
  last,
}: Props) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)
  const locale = useDirectionStore((s) => s.locale)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(template.name)

  const start = () => {
    setName(template.name)
    setEditing(true)
  }
  const commit = () => {
    if (name.trim()) onRename(name.trim())
    setEditing(false)
  }

  const lastUsedOn = template.lastUsedAt
    ? parseISODate(template.lastUsedAt.slice(0, 10))
    : null
  // Whether a saved mapping is still current is a question about recency, not a date.
  const lastUsed =
    template.lastUsedAt === null
      ? null
      : formatRelativeTime(template.lastUsedAt, locale)

  return (
    <div className={last ? '' : 'border-b border-fp-border'}>
      <div className="flex flex-wrap items-center gap-2 px-[18px] py-[13px]">
        {editing ? (
          <Input
            value={name}
            autoFocus
            aria-label="Template name"
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
              {template.name}
            </span>
            <span className={PILL}>
              {template.useCount === 1
                ? 'used once'
                : `used ${template.useCount} times`}
            </span>
            {lastUsed ? (
              <span
                className={PILL}
                title={
                  lastUsedOn ? formatDate(lastUsedOn, dateFormat) : undefined
                }
              >
                {lastUsed}
              </span>
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
              title="What this template remembers"
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
              onClick={onDelete}
              title="Delete"
              className={`${ICON_BTN} hover:text-fp-danger`}
            >
              <Trash2 size={15} strokeWidth={1.8} />
            </Button>
          </>
        )}
      </div>

      {template.nameConflict === 1 ? (
        <p className="px-[18px] pb-[11px] text-[12.5px] text-fp-danger">
          Another template on your account already uses this name. Rename it to
          finish syncing.
        </p>
      ) : null}

      {template.config === null ? (
        <p className="px-[18px] pb-[11px] text-[12.5px] text-fp-text-2">
          Needs rebuilding — this mapping was saved by a newer version of Means
          than this one. Import a file with it once from that device, or save a
          new template here.
        </p>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-2 border-t border-fp-border bg-fp-surface-2 px-[18px] py-3">
          {answers.length === 0 ? (
            <span className="text-[12.5px] text-fp-text-3">
              This mapping answers no file values of its own — every row uses
              its defaults.
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] font-semibold text-fp-text-2">
                Recognises
              </span>
              {answers.map((answer) => (
                <span
                  key={answer}
                  className="max-w-[200px] truncate rounded-full border border-fp-border bg-fp-surface px-[9px] py-[3px] text-[12px] text-fp-text-2"
                >
                  {answer}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
