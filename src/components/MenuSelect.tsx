import { ChevronDownIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { cn } from '#/lib/utils'

export type MenuSelectOption<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  value: T
  options: ReadonlyArray<MenuSelectOption<T>>
  onChange: (value: T) => void
  /** Shown on the trigger; the chosen option's label by default. */
  label?: string
  /** Leads the trigger's label. */
  icon?: ReactNode
  /** `prominent` heads a toolbar; `quiet` sits beside it. */
  appearance?: 'prominent' | 'quiet'
  title?: string
}

const TRIGGER = {
  prominent:
    'gap-[9px] rounded-[12px] border-fp-border-strong bg-fp-surface py-[9px] ps-3 pe-[10px] text-[14.5px] font-extrabold text-fp-text shadow-fp',
  quiet:
    'gap-[6px] rounded-[10px] border-fp-border bg-fp-surface py-[7px] ps-[11px] pe-[9px] text-[12.5px] font-bold text-fp-text-2',
}

/** A pill that opens a one-choice menu — a styled stand-in for a native select. */
export function MenuSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  icon,
  appearance = 'quiet',
  title,
}: Props<T>) {
  const chosen = options.find((o) => o.value === value)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={title}
        className={cn(
          'inline-flex max-w-full min-w-0 cursor-pointer items-center border outline-none focus-visible:border-fp-accent',
          TRIGGER[appearance],
        )}
      >
        {icon}
        <span className="truncate whitespace-nowrap">
          {label ?? chosen?.label}
        </span>
        <ChevronDownIcon className="size-[14px] flex-none text-fp-text-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        <DropdownMenuRadioGroup value={value}>
          {options.map((o) => (
            // `onSelect`, not the group's change event: picking the chosen option again
            // still reaches the caller, e.g. to re-open a custom range.
            <DropdownMenuRadioItem
              key={o.value}
              value={o.value}
              onSelect={() => onChange(o.value)}
            >
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
