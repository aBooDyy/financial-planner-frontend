import { Check } from 'lucide-react'
import { BrandMark } from './BrandMark'

type Props = {
  headline: string
  sub: string
  ticks: ReadonlyArray<string>
}

/** Desktop-only marketing rail: emerald gradient, sample net-worth card, and value props. */
export function BrandPanel({ headline, sub, ticks }: Props) {
  return (
    <div
      className="relative hidden w-[46%] max-w-[560px] flex-none flex-col overflow-hidden px-[46px] py-12 text-white lg:flex"
      style={{ background: 'linear-gradient(155deg,#22A574 0%,#0E6B47 78%)' }}
    >
      <div className="absolute -top-[120px] -right-[90px] h-[340px] w-[340px] rounded-full bg-white/[0.07]" />
      <div className="absolute -bottom-[130px] -left-[70px] h-[300px] w-[300px] rounded-full bg-white/[0.05]" />

      <div className="relative">
        <BrandMark tone="onDark" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center py-9">
        <h2 className="m-0 max-w-[380px] text-[34px] leading-[1.12] font-extrabold tracking-[-0.025em] text-balance">
          {headline}
        </h2>
        <p className="mt-4 max-w-[360px] text-[15.5px] leading-relaxed text-white/80">
          {sub}
        </p>

        <div className="mt-[30px] max-w-[330px] rounded-[18px] border border-white/[0.18] bg-white/[0.12] px-5 py-[18px] backdrop-blur-md">
          <div className="text-[12px] font-bold tracking-[0.05em] text-white/70 uppercase">
            Total liquid cash
          </div>
          <div className="mt-1.5 text-[28px] font-extrabold tracking-[-0.02em] tabular-nums">
            SR 99,258.00
          </div>
          <div className="mt-3.5 flex h-[9px] gap-0.5 overflow-hidden rounded-md bg-white/[0.18]">
            <div className="w-[80%] bg-white" />
            <div className="w-[13%] bg-white/[0.62]" />
            <div className="w-[5%] bg-white/40" />
            <div className="w-[2%] bg-white/[0.28]" />
          </div>
          <div className="mt-[11px] text-[12px] text-white/70">
            9 wallets · 4 groups · 3 currencies
          </div>
        </div>
      </div>

      <div className="relative flex flex-col gap-[11px]">
        {ticks.map((tick) => (
          <div
            key={tick}
            className="flex items-center gap-2.5 text-[14px] text-white/90"
          >
            <Check
              size={17}
              strokeWidth={2.4}
              className="flex-shrink-0 opacity-90"
            />
            <span>{tick}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
