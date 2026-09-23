import { STATUS_COLORS } from '#/features/goals/constants'
import type { Decision } from '#/features/goals/data/selectors'
import { SURFACE_CARD } from './styles'

type Props = {
  decisions: Decision[]
  onOpen: (goalId: string) => void
}

export function DecisionsCard({ decisions, onOpen }: Props) {
  return (
    <div className={`px-4 py-[15px] ${SURFACE_CARD}`}>
      <div className="mb-3 text-[13.5px] font-bold">Needs a decision</div>
      <div className="flex flex-col gap-[11px]">
        {decisions.map((d) => (
          <button
            key={d.goalId}
            type="button"
            onClick={() => onOpen(d.goalId)}
            className="flex w-full items-center gap-[10px] rounded-[9px] text-start hover:opacity-75"
          >
            <span
              className="h-[7px] w-[7px] flex-none rounded-full"
              style={{ background: STATUS_COLORS.red.main }}
            />
            <span className="min-w-0 flex-1 text-[13px]">{d.text}</span>
            <span className="text-[12px] font-bold whitespace-nowrap text-fp-accent-ink">
              {d.action}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
