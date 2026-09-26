import { Check } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { useCopy } from '#/features/integrations/hooks/useCopy'
import { SMALL_BUTTON, SOFT_BUTTON } from './buttonStyles'

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
    <div className="flex flex-col gap-[7px]">
      <div className="flex min-w-0 items-center gap-[10px] rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface-2 py-2 ps-[14px] pe-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent py-1 text-start font-mono text-[12.5px] text-fp-text outline-none"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => void onClick()}
          aria-label={`Copy ${label.toLowerCase()}`}
          className={`${SMALL_BUTTON} ${SOFT_BUTTON} shrink-0`}
        >
          Copy
        </Button>
      </div>
      <span
        aria-live="polite"
        className={`flex items-center gap-1 text-[12px] font-semibold ${failed && !copied ? 'text-fp-danger' : 'text-fp-accent-ink'}`}
      >
        {copied ? (
          <>
            <Check aria-hidden size={13} strokeWidth={2.6} />
            <span>Copied</span>
          </>
        ) : failed ? (
          'Couldn’t copy — select the text and copy it by hand.'
        ) : null}
      </span>
    </div>
  )
}
