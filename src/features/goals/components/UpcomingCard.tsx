import { CalendarCheck } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import type { UpcomingEvent } from '#/features/goals/data/selectors'
import { SURFACE_CARD } from './styles'

export function UpcomingCard({ events }: { events: UpcomingEvent[] }) {
  return (
    <div className={`px-4 py-[15px] ${SURFACE_CARD}`}>
      <div className="mb-3 text-[13.5px] font-bold">Next 60 days</div>
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          size="sm"
          title="Nothing due soon"
          text="No income, bills or set-asides in the next 60 days."
        />
      ) : (
        <div className="flex flex-col gap-[10px]">
          {events.map((e) => (
            <div key={e.key} className="flex items-baseline gap-[10px]">
              <span className="w-[56px] flex-none text-[12px] font-bold text-fp-text-3 tabular-nums">
                {e.dateStr}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {e.name}
              </span>
              <span
                className={`text-[13px] font-bold whitespace-nowrap tabular-nums ${
                  e.incoming ? 'text-fp-accent' : ''
                }`}
              >
                {e.amountStr}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
