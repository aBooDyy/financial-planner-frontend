import { useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '#/components/ui/popover'
import { CountsTowardOptions } from '#/features/transactions/components/CountsTowardOptions'
import { CountsTowardRow } from '#/features/transactions/components/CountsTowardRow'
import type { CountsToward } from '#/features/transactions/hooks/useCountsToward'

type Props = {
  counts: CountsToward
  onPick: (optionId: string | null) => void
}

const HINT = 'px-1 text-[12px] leading-[1.45] text-fp-text-3'

/** The bill, goal or income stream the entry counts toward, picked from a list under the row. */
export function ReviewCountsToward({ counts, onPick }: Props) {
  const [open, setOpen] = useState(false)
  if (!counts.face) return null

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div>
            <CountsTowardRow face={counts.face} onOpen={() => setOpen(true)} />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[min(360px,calc(100vw-32px))] p-0"
        >
          <CountsTowardOptions
            options={counts.options}
            isIncome={counts.isIncome}
            selectedId={counts.selectedId}
            onPick={(id) => {
              onPick(id)
              setOpen(false)
            }}
            listClassName="max-h-[280px]"
          />
        </PopoverContent>
      </Popover>
      {counts.infoHint === 'saving-goal' ? (
        <p className={HINT}>
          Counts as spending this goal’s money. To put money aside, use Add
          money on the goal.
        </p>
      ) : null}
      {counts.infoHint === 'no-payday' ? (
        <p className={HINT}>
          No planned payday near this date — it saves as regular income.
        </p>
      ) : null}
    </div>
  )
}
