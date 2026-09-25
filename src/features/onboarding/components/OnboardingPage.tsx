import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { User } from '#/features/auth/api/types'
import { PROGRESS_STEPS, useOnboardingFlow } from '../hooks/useOnboardingFlow'
import { CategoriesStep } from './CategoriesStep'
import { CurrencyStep } from './CurrencyStep'
import { DoneStep } from './DoneStep'
import { EmailStep } from './EmailStep'
import { GoalsStep } from './GoalsStep'
import { NameStep } from './NameStep'
import { OnboardingFooter } from './OnboardingFooter'
import { OnboardingHeader } from './OnboardingHeader'

type Props = { user: User }

/** The first-run wizard: five short steps, then a welcome. */
export function OnboardingPage({ user }: Props) {
  const hasInbox = (useLiveQuery(() => db.emailConnections.count()) ?? 0) > 0
  const flow = useOnboardingFlow(user, hasInbox)
  const scroller = useRef<HTMLElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
  }, [flow.step])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-fp-bg text-fp-text">
      <OnboardingHeader
        step={flow.step}
        total={PROGRESS_STEPS}
        showProgress={flow.showProgress}
        canGoBack={flow.canGoBack}
        onBack={flow.back}
      />
      <main ref={scroller} className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-5 pt-3.5 pb-7 md:px-10 md:pt-[52px] md:pb-9">
          {flow.step === 1 && <NameStep onSubmit={flow.next} />}
          {flow.step === 2 && <GoalsStep firstName={flow.firstName} />}
          {flow.step === 3 && <CategoriesStep />}
          {flow.step === 4 && <CurrencyStep />}
          {flow.step === 5 && <EmailStep />}
          {flow.step === 6 && <DoneStep firstName={flow.firstName} />}
        </div>
      </main>
      <OnboardingFooter
        ctaLabel={flow.cta.label}
        ctaDisabled={flow.cta.disabled}
        canGoBack={flow.canGoBack}
        error={flow.error}
        onNext={flow.next}
        onBack={flow.back}
      />
    </div>
  )
}
