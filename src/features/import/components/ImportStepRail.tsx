import { Check, ChevronRight } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import type { ImportStep } from '#/features/import/hooks/useCsvImport'

type Props = {
  current: ImportStep
  canGoTo: (step: ImportStep) => boolean
  onSelect: (step: ImportStep) => void
}

const RAIL: ReadonlyArray<{ step: ImportStep; label: string }> = [
  { step: 'file', label: 'File' },
  { step: 'columns', label: 'Columns' },
  { step: 'values', label: 'Values' },
  { step: 'review', label: 'Review' },
  { step: 'done', label: 'Done' },
]

const ITEM =
  'gap-[7px] rounded-full border-0 px-[11px] py-[7px] text-[12.5px] font-semibold text-fp-text-3 data-[state=on]:bg-fp-accent-soft data-[state=on]:text-fp-accent-ink disabled:opacity-100'

const MARK =
  'flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold'

/** Where the wizard is. Steps already reached go back; steps ahead are inert. */
export function ImportStepRail({ current, canGoTo, onSelect }: Props) {
  const active: ImportStep = current === 'committing' ? 'review' : current
  const activeIndex = RAIL.findIndex((entry) => entry.step === active)

  return (
    <ToggleGroup
      type="single"
      value={active}
      spacing={1}
      aria-label="Import steps"
      className="w-full flex-wrap justify-start rounded-2xl border border-fp-border bg-fp-surface px-2 py-[7px] shadow-fp"
      onValueChange={(value) => {
        if (value) onSelect(value as ImportStep)
      }}
    >
      {RAIL.map((entry, index) => {
        const done = index < activeIndex
        const isActive = entry.step === active
        return (
          <div key={entry.step} className="flex items-center">
            {index > 0 ? (
              <ChevronRight
                size={14}
                aria-hidden
                className="shrink-0 text-fp-text-3 rtl:-scale-x-100"
              />
            ) : null}
            <ToggleGroupItem
              value={entry.step}
              className={ITEM}
              disabled={!canGoTo(entry.step)}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={`${MARK} ${
                  isActive
                    ? 'bg-fp-accent text-white'
                    : 'bg-fp-surface-2 text-fp-text-3'
                }`}
              >
                {done ? <Check size={12} strokeWidth={3} /> : index + 1}
              </span>
              <span className={isActive ? 'inline' : 'hidden sm:inline'}>
                {entry.label}
              </span>
            </ToggleGroupItem>
          </div>
        )
      })}
    </ToggleGroup>
  )
}
