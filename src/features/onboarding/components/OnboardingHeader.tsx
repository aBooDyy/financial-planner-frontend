import { ChevronLeft } from 'lucide-react'
import { BrandMark } from '#/components/chrome/BrandMark'
import { cn } from '#/lib/utils'
import { StepProgress } from './StepProgress'

type Props = {
  step: number
  total: number
  showProgress: boolean
  canGoBack: boolean
  onBack: () => void
}

/** Desktop: the brand beside a centred progress bar. Mobile: back, progress, "2/5". */
export function OnboardingHeader({
  step,
  total,
  showProgress,
  canGoBack,
  onBack,
}: Props) {
  const current = Math.min(step, total)

  return (
    <>
      <header className="hidden flex-none items-center gap-5 border-b border-fp-border px-8 py-5 md:flex">
        <div className="w-40">
          <BrandMark />
        </div>
        <div className="flex flex-1 justify-center">
          {showProgress && (
            <div className="flex w-full max-w-[320px] flex-col items-center gap-2">
              <StepProgress step={step} total={total} />
              <span className="text-[12px] font-semibold text-fp-text-3">
                Step {current} of {total}
              </span>
            </div>
          )}
        </div>
        <div className="w-40" />
      </header>

      <header className="flex flex-none items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-3 md:hidden">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className={cn(
            'flex size-9 cursor-pointer items-center justify-center rounded-[10px] text-fp-text-2',
            !canGoBack && 'invisible',
          )}
        >
          <ChevronLeft size={20} strokeWidth={2} className="rtl:rotate-180" />
        </button>
        {showProgress && (
          <>
            <StepProgress step={step} total={total} className="flex-1" />
            <span className="w-9 text-end text-[12px] font-semibold text-fp-text-3">
              {current}/{total}
            </span>
          </>
        )}
      </header>
    </>
  )
}
