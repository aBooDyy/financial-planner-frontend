import { Check, Copy } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useCopy } from '#/features/integrations/hooks/useCopy'

type Props = {
  value: string
  label: string
  onCopied?: () => void
}

/**
 * A technical string the user pastes elsewhere — a URL, a key. Always an LTR island, and
 * `readOnly` rather than disabled so it stays selectable by hand.
 */
export function CopyField({ value, label, onCopied }: Props) {
  const { copied, failed, copy } = useCopy()

  const onClick = async () => {
    if (await copy(value)) onCopied?.()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          aria-label={label}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 text-start font-mono text-[13px]"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void onClick()}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="h-[46px] w-[46px] shrink-0 rounded-xl bg-fp-surface"
        >
          {copied ? (
            <Check size={17} strokeWidth={2.2} className="text-fp-accent" />
          ) : (
            <Copy size={17} strokeWidth={1.9} />
          )}
        </Button>
      </div>
      <span aria-live="polite" className="text-[12px] text-fp-text-3">
        {copied
          ? 'Copied'
          : failed
            ? 'Couldn’t copy — select the text and copy it by hand.'
            : ''}
      </span>
    </div>
  )
}
