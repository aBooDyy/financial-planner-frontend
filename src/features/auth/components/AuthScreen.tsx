import { Link } from '@tanstack/react-router'
import { Divider } from '#/components/Divider'
import { OfflineNotice } from '#/components/OfflineNotice'
import { useOnline } from '#/hooks/useOnline'
import { BrandMark } from './BrandMark'
import { BrandPanel } from './BrandPanel'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'
import { SocialAuthButtons } from './SocialAuthButtons'

type Mode = 'login' | 'signup'

const TICKS = [
  'Multi-currency, one clear total',
  'Nest wallets into flexible jars',
  'Goals & budgets that adapt',
] as const

const COPY = {
  login: {
    brandHeadline: 'Plan around what you actually have.',
    brandSub:
      'One running total across every wallet, jar and currency — and goals that adapt as life does.',
    eyebrow: 'Welcome back',
    title: 'Log in to Means',
    sub: 'Pick up right where you left off.',
    switchPrompt: 'New to Means?',
    switchAction: 'Create account',
    switchTo: '/auth/signup',
    offline:
      'You’re offline. Signing in needs a connection — try again once you’re back online.',
  },
  signup: {
    brandHeadline: 'Start with a clear picture of your money.',
    brandSub:
      'Means maps every wallet, jar and currency into one running total — then helps you set goals you can actually keep.',
    eyebrow: 'Get started',
    title: 'Create your account',
    sub: 'Free to start. No card, no bank connection required.',
    switchPrompt: 'Already have an account?',
    switchAction: 'Log in',
    switchTo: '/auth/login',
    offline:
      'You’re offline. Creating an account needs a connection — try again once you’re back online.',
  },
} as const

export function AuthScreen({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const online = useOnline()

  return (
    <div className="flex min-h-dvh w-full overflow-hidden bg-fp-bg text-fp-text">
      <BrandPanel
        headline={copy.brandHeadline}
        sub={copy.brandSub}
        ticks={TICKS}
      />

      <div className="flex flex-1 items-center justify-center overflow-auto px-[26px] py-10 lg:px-12">
        <div className="w-full max-w-[382px] [animation:fp-fade-in_.25s_ease]">
          <div className="mb-[30px] lg:hidden">
            <BrandMark tone="onLight" />
          </div>

          <div className="text-[13px] font-bold tracking-[0.04em] text-fp-accent-ink uppercase">
            {copy.eyebrow}
          </div>
          <h1 className="mt-2 text-[27px] leading-[1.15] font-extrabold tracking-[-0.022em]">
            {copy.title}
          </h1>
          <p className="mt-[9px] text-[14.5px] leading-[1.5] text-fp-text-2">
            {copy.sub}
          </p>

          {online ? null : (
            <OfflineNotice className="mt-[18px] rounded-xl bg-fp-surface-2 px-3.5 py-2.5 text-[13px]">
              {copy.offline}
            </OfflineNotice>
          )}

          <div className="mt-[26px]">
            <SocialAuthButtons showPasskey={mode === 'login'} />
          </div>

          <Divider label="or with email" />

          {mode === 'login' ? <LoginForm /> : <SignupForm />}

          <div className="mt-[22px] text-center text-[14px] text-fp-text-2">
            {copy.switchPrompt}{' '}
            <Link
              to={copy.switchTo}
              className="font-bold text-fp-accent-ink hover:underline"
            >
              {copy.switchAction}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
