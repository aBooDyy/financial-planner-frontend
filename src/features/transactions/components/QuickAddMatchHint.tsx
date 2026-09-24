import { Switch } from '#/components/ui/switch'
import { cn } from '#/lib/utils'

type Props = {
  hint: string
  linked: boolean
  onLinkedChange: (linked: boolean) => void
}

/** One line under QuickAdd's input: the planned item this entry settles, and the opt-out. */
export function QuickAddMatchHint({ hint, linked, onLinkedChange }: Props) {
  return (
    <div className="mb-[11px] flex items-center gap-[10px] rounded-[10px] bg-fp-accent-soft px-[11px] py-[6px]">
      <p
        className={cn(
          'min-w-0 flex-1 truncate text-[12px] font-semibold text-fp-accent-ink',
          !linked && 'line-through opacity-60',
        )}
        title={hint}
      >
        {hint}
      </p>
      <label className="flex flex-none items-center gap-[6px] text-[11.5px] font-semibold text-fp-text-2">
        Link it
        <Switch
          checked={linked}
          onCheckedChange={onLinkedChange}
          aria-label="Link it"
        />
      </label>
    </div>
  )
}
