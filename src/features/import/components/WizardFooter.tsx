import { ArrowRight } from 'lucide-react'
import { Button } from '#/components/ui/button'

type Props = {
  backLabel?: string
  onBack?: () => void
  nextLabel: string
  onNext: () => void
  disabled?: boolean
  /** Why `next` is unavailable — shown as text, never only as a tooltip. */
  reason?: string | null
}

/** Step navigation: inline on desktop, pinned to the bottom of the step on mobile. */
export function WizardFooter({
  backLabel = 'Back',
  onBack,
  nextLabel,
  onNext,
  disabled = false,
  reason = null,
}: Props) {
  return (
    <div className="sticky bottom-0 -mx-[14px] flex flex-col gap-2 border-t border-fp-border bg-fp-bg/95 px-[14px] py-3 backdrop-blur-[10px] md:static md:mx-0 md:rounded-2xl md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
      {reason ? (
        <p className="text-[12.5px] text-fp-text-2 md:text-end">{reason}</p>
      ) : null}
      <div className="flex items-center gap-2.5">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            className="px-[16px] py-[10px] text-[13.5px]"
            onClick={onBack}
          >
            {backLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={disabled}
          className="ms-auto gap-[7px] px-[18px] py-[10px] text-[13.5px]"
          onClick={onNext}
        >
          {nextLabel}
          <ArrowRight size={15} strokeWidth={2} className="rtl:-scale-x-100" />
        </Button>
      </div>
    </div>
  )
}
