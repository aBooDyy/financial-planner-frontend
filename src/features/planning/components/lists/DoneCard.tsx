import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '#/lib/utils'
import { PlanCard } from '#/features/planning/components/kit/PlanCard'
import { Spine } from '#/features/planning/components/kit/Spine'

export type DoneItem = {
  id: string
  name: string
  color: string
  note: string
  /** Null when it can't be reopened (a paid one-off). */
  onReopen: (() => void) | null
  onOpen: () => void
}

/** The collapsed "Done" / "Reached" card: finished items, each with Reopen. */
export function DoneCard({
  title,
  items,
}: {
  title: string
  items: ReadonlyArray<DoneItem>
}) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null
  return (
    <PlanCard className="overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-start"
      >
        <span className="text-[15px] font-extrabold">{title}</span>
        <span className="text-[13px] font-bold text-fp-text-3 tabular-nums">
          {items.length}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            'ms-auto text-fp-text-3 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-stretch gap-3 border-t border-fp-border px-4 py-3"
            >
              <Spine color={item.color} />
              <button
                type="button"
                onClick={item.onOpen}
                className="min-w-0 flex-1 text-start"
              >
                <span className="block truncate text-[13.5px] font-bold text-fp-text-2">
                  {item.name}
                </span>
                <span className="block truncate text-[11.5px] text-fp-text-3">
                  {item.note}
                </span>
              </button>
              {item.onReopen ? (
                <button
                  type="button"
                  onClick={item.onReopen}
                  className="self-center rounded-[9px] border border-fp-border px-[10px] py-[6px] text-[12.5px] font-bold text-fp-accent-ink hover:border-fp-border-strong"
                >
                  Reopen
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </PlanCard>
  )
}
