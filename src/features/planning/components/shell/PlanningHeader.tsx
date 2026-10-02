import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'

/** The page's title row: "Planning", what it answers, and + Plan something. */
export function PlanningHeader({ onPlan }: { onPlan: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-fp-text md:text-[26px]">
          Planning
        </h1>
        <p className="mt-[2px] hidden text-[13px] text-fp-text-3 md:block">
          What&rsquo;s coming, and whether you&rsquo;re ready for it.
        </p>
      </div>
      <Button
        type="button"
        onClick={onPlan}
        className="h-[34px] rounded-full px-[13px] text-[13px] md:h-auto md:rounded-[11px] md:px-[15px] md:py-[9px]"
      >
        <Plus size={16} strokeWidth={2.4} />
        <span className="md:hidden">Plan</span>
        <span className="hidden md:inline">Plan something</span>
      </Button>
    </div>
  )
}
