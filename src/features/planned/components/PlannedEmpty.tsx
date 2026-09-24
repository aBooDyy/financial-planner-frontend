import { Link } from '@tanstack/react-router'
import { CalendarClock } from 'lucide-react'

/** The Planned tab with nothing on it. */
export function PlannedEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-[13px] border-[1.5px] border-dashed border-fp-border-strong text-fp-text-3">
        <CalendarClock size={20} strokeWidth={1.9} />
      </span>
      <p className="max-w-[340px] text-[13.5px] text-fp-text-2">
        Nothing planned. Income, obligations and goal set-asides show up here
        once you add them on the Goals page.
      </p>
      <Link
        to="/goals"
        className="text-[13px] font-bold text-fp-accent-ink underline-offset-4 hover:underline"
      >
        Go to Goals
      </Link>
    </div>
  )
}
