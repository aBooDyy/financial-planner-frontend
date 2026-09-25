import { Eye, Lock, ShieldCheck } from 'lucide-react'

const PROMISES = [
  {
    Icon: Eye,
    title: 'Receipts and bank alerts only.',
    sub: 'We skip everything else in your inbox.',
  },
  {
    Icon: Lock,
    title: 'Read-only access.',
    sub: 'Disconnect anytime from Settings.',
  },
  {
    Icon: ShieldCheck,
    title: 'Private by default.',
    sub: 'Your data is never shared or sold.',
  },
] as const

export function PrivacyPromises() {
  return (
    <ul className="mt-[26px] flex max-w-[460px] flex-col gap-3">
      {PROMISES.map(({ Icon, title, sub }) => (
        <li key={title} className="flex items-start gap-[11px]">
          <Icon
            size={17}
            strokeWidth={1.8}
            className="mt-px flex-none text-fp-accent-ink"
          />
          <p className="text-[14px] leading-[1.5] text-fp-text-2">
            <b className="font-semibold text-fp-text">{title}</b> {sub}
          </p>
        </li>
      ))}
    </ul>
  )
}
