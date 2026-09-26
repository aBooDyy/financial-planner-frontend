import { ChevronDown } from 'lucide-react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { windowLabel, windowOptions } from '#/features/email-sync/data/windows'
import { useConfigLimits } from '#/lib/config/appConfig'

type Props = {
  onPick: (days: number) => void
  disabled?: boolean
}

/**
 * A backfill: read a window of older mail again under today's rules. Anything already
 * staged, confirmed or dismissed stays as it is.
 */
export function OlderEmailsMenu({ onPick, disabled = false }: Props) {
  const maxLookbackDays = useConfigLimits().emailSyncMaxLookbackDays
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="quiet"
          disabled={disabled}
          className="shrink-0 gap-1 px-3 py-[9px] text-[13px] font-bold"
        >
          Older emails
          <ChevronDown size={14} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[210px]">
        <DropdownMenuLabel className="text-[12px] font-normal text-fp-text-3">
          Read again under today’s rules. What you already reviewed stays
          reviewed.
        </DropdownMenuLabel>
        {windowOptions(maxLookbackDays).map((days) => (
          <DropdownMenuItem key={days} onSelect={() => onPick(days)}>
            {windowLabel(days)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
