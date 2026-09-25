import { Check } from 'lucide-react'

type Props = { firstName: string }

export function DoneStep({ firstName }: Props) {
  return (
    <div className="flex flex-col items-start pt-6 text-start md:items-center md:pt-5 md:text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-fp-accent text-white">
        <Check size={30} strokeWidth={2.6} />
      </span>
      <div className="mt-[22px] text-[13px] font-bold tracking-[0.04em] text-fp-accent-ink uppercase">
        You're all set
      </div>
      <h1 className="mt-2 text-[26px] leading-[1.12] font-extrabold tracking-[-0.024em] md:text-[32px]">
        {firstName ? `Welcome aboard, ${firstName}` : 'Welcome aboard'}
      </h1>
      <p className="mt-3 max-w-[400px] text-[15.5px] leading-[1.55] text-pretty text-fp-text-2">
        Your Means is ready. Let's make your money a little easier to follow,
        starting today.
      </p>
    </div>
  )
}
