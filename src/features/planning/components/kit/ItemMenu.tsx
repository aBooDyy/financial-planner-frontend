import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'

export type MenuAction = {
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
}

/** A row's ⋯ menu; destructive actions sit apart, last. */
export function ItemMenu({
  label,
  actions,
}: {
  /** "More for Rent". */
  label: string
  actions: ReadonlyArray<MenuAction>
}) {
  const plain = actions.filter((a) => !a.destructive)
  const danger = actions.filter((a) => a.destructive)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="flex size-[30px] flex-none items-center justify-center rounded-[9px] text-fp-text-3 transition hover:bg-fp-surface-2 hover:text-fp-text"
        >
          <MoreHorizontal size={17} strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[190px]"
        onClick={(e) => e.stopPropagation()}
      >
        {plain.map((a) => (
          <DropdownMenuItem
            key={a.label}
            disabled={a.disabled}
            onSelect={a.onSelect}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
        {danger.length > 0 && plain.length > 0 ? (
          <DropdownMenuSeparator />
        ) : null}
        {danger.map((a) => (
          <DropdownMenuItem
            key={a.label}
            variant="destructive"
            disabled={a.disabled}
            onSelect={a.onSelect}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
