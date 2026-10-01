import { Link } from '@tanstack/react-router'
import { ChevronRight, Repeat, Target, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LinkProps } from '@tanstack/react-router'
import { RailCardHeader } from '#/components/RailCardHeader'

type Step = {
  key: string
  icon: LucideIcon
  title: string
  text: string
  link: Pick<LinkProps, 'to' | 'params'>
}

const STEPS: Step[] = [
  {
    key: 'income',
    icon: Wallet,
    title: 'Add your income',
    text: 'Paydays show up to confirm when they land.',
    link: { to: '/goals/$section', params: { section: 'income' } },
  },
  {
    key: 'obligations',
    icon: Repeat,
    title: 'Add your bills',
    text: 'Rent, loans and other bills, due on time.',
    link: { to: '/goals/$section', params: { section: 'obligations' } },
  },
  {
    key: 'goals',
    icon: Target,
    title: 'Set a goal',
    text: 'Monthly set-asides that get you there.',
    link: { to: '/goals/$section', params: { section: 'goals' } },
  },
]

/** The Planned tab's rail while nothing is planned: where planned items come from. */
export function PlanningGuideCard() {
  return (
    <div className="rounded-[18px] border border-fp-border bg-fp-surface p-[18px] shadow-fp">
      <RailCardHeader
        title="How planning works"
        sub="Add any of these and they're planned here"
      />
      <ul className="-mx-2 flex flex-col">
        {STEPS.map(({ key, icon: StepIcon, title, text, link }) => (
          <li key={key}>
            <Link
              {...link}
              className="flex items-center gap-3 rounded-[12px] px-2 py-[9px] outline-none hover:bg-fp-surface-2 focus-visible:ring-2 focus-visible:ring-fp-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-fp-accent-soft text-fp-accent-ink">
                <StepIcon aria-hidden size={17} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">{title}</span>
                <span className="block text-[12px] text-fp-text-2">{text}</span>
              </span>
              <ChevronRight
                aria-hidden
                size={15}
                className="shrink-0 text-fp-text-3 rtl:rotate-180"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
