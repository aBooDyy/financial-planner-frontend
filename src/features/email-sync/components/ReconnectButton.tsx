import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

type Props = {
  busy: boolean
  onReconnect: () => void
  disabled?: boolean
  variant?: 'default' | 'outline'
  className?: string
}

/** Off to the provider to sign an inbox in again. */
export function ReconnectButton({
  busy,
  onReconnect,
  disabled = false,
  variant = 'default',
  className,
}: Props) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={onReconnect}
      disabled={busy || disabled}
      className={cn(
        'shrink-0 gap-1.5 px-[14px] py-[9px] text-[13px]',
        variant === 'outline' && 'bg-fp-surface font-semibold',
        className,
      )}
    >
      {busy ? (
        <Loader2 size={15} strokeWidth={2} className="animate-spin" />
      ) : (
        <KeyRound size={15} strokeWidth={2} />
      )}
      Reconnect
    </Button>
  )
}
