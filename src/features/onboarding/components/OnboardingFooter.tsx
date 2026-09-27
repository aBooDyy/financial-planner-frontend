import { ChevronLeft } from 'lucide-react'
import { OfflineNotice } from '#/components/OfflineNotice'
import { Button } from '#/components/ui/button'

type Props = {
  ctaLabel: string
  ctaDisabled: boolean
  canGoBack: boolean
  error: string | null
  offlineNote?: string | null
  onNext: () => void
  onBack: () => void
}

/** The pinned action bar: Back (desktop only — mobile has it in the header) and the CTA. */
export function OnboardingFooter({
  ctaLabel,
  ctaDisabled,
  canGoBack,
  error,
  offlineNote,
  onNext,
  onBack,
}: Props) {
  return (
    <footer className="flex-none border-t border-fp-border bg-fp-bg px-5 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+16px)] md:px-10 md:py-4">
      <div className="mx-auto max-w-[720px]">
        {error && (
          <p role="alert" className="mb-3 text-[13.5px] text-fp-danger">
            {error}
          </p>
        )}
        {offlineNote ? (
          <OfflineNotice className="mb-3">{offlineNote}</OfflineNotice>
        ) : null}
        <div className="flex items-center gap-3">
          {canGoBack && (
            <Button
              variant="ghost"
              onClick={onBack}
              className="hidden rounded-xl px-4 py-3 text-[14.5px] text-fp-text-2 md:inline-flex"
            >
              <ChevronLeft
                size={16}
                strokeWidth={2}
                className="rtl:rotate-180"
              />
              Back
            </Button>
          )}
          <div className="hidden flex-1 md:block" />
          <Button
            onClick={onNext}
            disabled={ctaDisabled}
            className="flex-1 rounded-[13px] px-6 py-3.5 text-[15px] md:flex-none"
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </footer>
  )
}
