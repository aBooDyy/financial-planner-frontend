import { INTENTS } from '../data/packs'
import { useOnboardingDraft } from '../stores/onboardingDraft'
import { IntentCard } from './IntentCard'
import { StepIntro } from './StepIntro'

type Props = { firstName: string }

export function GoalsStep({ firstName }: Props) {
  const intents = useOnboardingDraft((s) => s.intents)
  const toggleIntent = useOnboardingDraft((s) => s.toggleIntent)

  return (
    <>
      <StepIntro
        eyebrow="Your goals"
        title={
          firstName
            ? `What brings you to Means, ${firstName}?`
            : 'What brings you to Means?'
        }
      >
        Pick as many as you like. We'll use your answers to suggest a starting
        set of categories.
      </StepIntro>
      <div className="mt-[26px] grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {INTENTS.map((intent) => (
          <IntentCard
            key={intent.id}
            intent={intent}
            on={intents.includes(intent.id)}
            onToggle={() => toggleIntent(intent.id)}
          />
        ))}
      </div>
    </>
  )
}
