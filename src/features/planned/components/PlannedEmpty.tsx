import { Link } from '@tanstack/react-router'
import { CalendarClock } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { Button } from '#/components/ui/button'

/** The Planned tab with nothing on it. */
export function PlannedEmpty() {
  return (
    <EmptyState
      icon={CalendarClock}
      title="Nothing planned"
      text="Income, obligations and goal set-asides show up here once you add them on the Goals page."
    >
      <Button
        asChild
        className="mt-1 rounded-[11px] px-[14px] py-[9px] text-[13px] font-bold"
      >
        <Link to="/goals">Go to Goals</Link>
      </Button>
    </EmptyState>
  )
}
