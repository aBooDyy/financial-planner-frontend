import type { ReactNode } from 'react'

type Props = {
  color: string
  selected: boolean
  onSelect: () => void
  muted?: boolean
  children: ReactNode
}

// A dense, clickable list row with a colour spine. Selecting it opens the item in the detail
// panel, so the row itself carries no buttons.
export function ListRow({ color, selected, onSelect, muted, children }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex w-full items-center gap-3 border-b border-fp-border px-[14px] py-[11px] text-start last:border-b-0 ${
        selected ? 'bg-fp-accent-soft' : 'hover:bg-fp-surface-2'
      } ${muted ? 'opacity-60' : ''}`}
    >
      {selected ? (
        <span className="absolute inset-y-0 start-0 w-[2px] bg-fp-accent" />
      ) : null}
      <span
        className="h-7 w-[3px] flex-none rounded-[2px]"
        style={{ background: color }}
      />
      {children}
    </button>
  )
}
