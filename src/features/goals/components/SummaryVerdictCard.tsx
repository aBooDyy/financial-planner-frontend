import { STATUS_COLORS } from '#/features/goals/constants'
import type { Verdict } from '#/features/goals/data/selectors'
import { Button } from '#/components/ui/button'

type Props = {
  verdict: Verdict
  primaryLabel: string
  onPrimary: () => void
  onSeeTimeline: () => void
}

export function SummaryVerdictCard({
  verdict,
  primaryLabel,
  onPrimary,
  onSeeTimeline,
}: Props) {
  const color = STATUS_COLORS[verdict.status].main

  return (
    <div
      className="flex flex-wrap items-center gap-[14px] rounded-[16px] border bg-fp-surface px-[18px] py-4 shadow-fp"
      style={{
        borderColor: verdict.status === 'green' ? 'var(--fp-border)' : color,
      }}
    >
      <div className="min-w-0 flex-1 basis-[220px]">
        <div
          className="text-[19px] font-extrabold tracking-[-0.02em]"
          style={{ color }}
        >
          {verdict.title}
        </div>
        <div className="mt-1 text-[13px] leading-[1.55] text-fp-text-2">
          {verdict.sub}
        </div>
      </div>
      <div className="flex flex-wrap gap-[7px]">
        <Button
          onClick={onPrimary}
          className="h-auto rounded-[9px] px-[14px] py-[9px] text-[12px] font-bold"
        >
          {primaryLabel}
        </Button>
        <Button
          variant="outline"
          onClick={onSeeTimeline}
          className="h-auto rounded-[9px] px-[14px] py-[9px] text-[12px] font-semibold hover:border-fp-accent"
        >
          See timeline
        </Button>
      </div>
    </div>
  )
}
