import { useState } from 'react'
import { useRecalcAll } from '#/features/planned'
import type { RecalcResult } from '#/features/planned'
import { Button } from '#/components/ui/button'
import { SURFACE_CARD } from './styles'

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

/**
 * Summary's "Recalculate all": shown while any goal's saved plan disagrees with today's
 * numbers (income or another goal changed), and briefly after, with an undo.
 */
export function RecalcAllCard() {
  const { offPlanGoalIds, recalcAll } = useRecalcAll()
  const [done, setDone] = useState<RecalcResult[] | null>(null)
  const [busy, setBusy] = useState(false)

  const run = (task: () => Promise<void>) => {
    setBusy(true)
    void task().finally(() => setBusy(false))
  }
  const recalc = () =>
    run(async () => {
      setDone(await recalcAll())
    })
  const undo = () =>
    run(async () => {
      for (const r of done ?? []) await r.undo()
      setDone(null)
    })

  if (done && done.length > 0)
    return (
      <div
        className={`${SURFACE_CARD} flex items-center gap-3 bg-fp-accent-soft px-4 py-3`}
      >
        <p className="flex-1 text-[12.5px] leading-normal text-fp-accent-ink">
          <b>{plural(done.length, 'plan', 'plans')} updated.</b> Future planned
          set-asides now follow today's numbers.
        </p>
        <Button
          variant="outline"
          onClick={undo}
          disabled={busy}
          className="h-auto rounded-[9px] px-3 py-[7px] text-[12px] font-bold"
        >
          Undo
        </Button>
        <Button
          variant="ghost"
          onClick={() => setDone(null)}
          className="h-auto rounded-[9px] px-2 py-[7px] text-[12px] font-semibold text-fp-text-2"
        >
          Done
        </Button>
      </div>
    )

  const count = offPlanGoalIds.length
  if (count === 0) return null
  return (
    <div
      className={`${SURFACE_CARD} flex flex-wrap items-center gap-3 px-4 py-3`}
    >
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="text-[13px] font-bold">
          {plural(count, 'goal is', 'goals are')} off{' '}
          {count === 1 ? 'its' : 'their'} saved plan
        </div>
        <p className="mt-[2px] text-[12px] leading-normal text-fp-text-3">
          Income, progress or other goals changed since the plan was saved.
          Recalculating rewrites future planned set-asides only.
        </p>
      </div>
      <Button
        onClick={recalc}
        disabled={busy}
        className="h-auto rounded-[9px] px-[14px] py-[9px] text-[12px] font-bold"
      >
        Recalculate all
      </Button>
    </div>
  )
}
