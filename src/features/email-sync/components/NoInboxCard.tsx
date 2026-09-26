import { Check, Lock, Mail, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

const PROMISES = [
  {
    title: 'Read-only',
    desc: 'Means only reads messages — never sends, replies, or deletes.',
  },
  {
    title: 'You choose',
    desc: 'Rules say which emails count and which account each one goes to.',
  },
  {
    title: 'Learned once',
    desc: 'Point out the amount and currency on one email; similar ones follow.',
  },
]

type Props = { canConnect: boolean; onConnect: () => void }

export function NoInboxCard({ canConnect, onConnect }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp">
      <div className="flex flex-wrap items-start gap-[18px] p-6">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[15px] bg-fp-accent-soft text-fp-accent-ink">
          <Mail size={26} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-extrabold tracking-[-0.01em]">
            Auto-log transactions from your inbox
          </div>
          <div className="mt-1.5 max-w-[580px] text-[13.5px] leading-relaxed text-fp-text-2">
            Connect the inbox where your bank and card alerts land. Means reads
            those emails, finds the amount and currency, and files each
            transaction into the account you choose.
          </div>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-px border-y border-fp-border bg-fp-border sm:grid-cols-3">
        {PROMISES.map((p) => (
          <li key={p.title} className="bg-fp-surface px-[18px] py-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-fp-accent-soft text-fp-accent-ink">
                <Check size={13} strokeWidth={2.6} />
              </span>
              <span className="text-[13.5px] font-bold">{p.title}</span>
            </div>
            <div className="text-[12.5px] leading-relaxed text-fp-text-3">
              {p.desc}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-4 px-6 py-[18px]">
        <Button
          type="button"
          disabled={!canConnect}
          onClick={onConnect}
          className="gap-1.5 px-5 py-3 text-[14px]"
        >
          <Plus size={16} strokeWidth={2.2} />
          Connect an inbox
        </Button>
        <span className="inline-flex items-center gap-[7px] text-[12.5px] text-fp-text-3">
          <Lock size={14} strokeWidth={1.8} />
          Read-only access · disconnect anytime
        </span>
      </div>
    </div>
  )
}
