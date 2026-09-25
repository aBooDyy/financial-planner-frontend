import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { firstNameOf } from '../data/name'
import { useOnboardingDraft } from '../stores/onboardingDraft'
import { StepIntro } from './StepIntro'

type Props = { onSubmit: () => void }

export function NameStep({ onSubmit }: Props) {
  const name = useOnboardingDraft((s) => s.name)
  const setName = useOnboardingDraft((s) => s.setName)
  const firstName = firstNameOf(name)

  return (
    <>
      <StepIntro
        eyebrow="Welcome to Means"
        title="First, what should we call you?"
      >
        A first name is plenty. It's how Means will greet you each day.
      </StepIntro>
      <form
        className="mt-[30px] max-w-[420px]"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <Label
          htmlFor="onboarding-name"
          className="mb-2 block text-[12.5px] font-semibold text-fp-text-2"
        >
          Your name
        </Label>
        <Input
          id="onboarding-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sara"
          autoComplete="given-name"
          maxLength={255}
          autoFocus
          className="h-auto rounded-[14px] border-fp-border-strong bg-fp-surface px-4 py-[15px] text-[18px] font-semibold md:text-[18px]"
        />
        {firstName && (
          <p className="mt-3.5 text-[14.5px] text-fp-text-2">
            Nice to meet you,{' '}
            <b className="font-bold text-fp-text">{firstName}</b>.
          </p>
        )}
      </form>
    </>
  )
}
