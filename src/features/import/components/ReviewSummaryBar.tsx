import { Switch } from '#/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { planLabel } from '#/features/import/data/importCounts'
import { REVIEW_FILTERS } from '#/features/import/data/review'
import type { ImportPlan } from '#/features/import/data/importCounts'
import type { ReviewCounts, ReviewFilter } from '#/features/import/data/review'

type Props = {
  counts: ReviewCounts
  /** What the included rows become — said only when some of them pair into transfers. */
  plan: ImportPlan
  filter: ReviewFilter
  onFilter: (filter: ReviewFilter) => void
  skipDuplicates: boolean
  onSkipDuplicates: (skip: boolean) => void
}

/** Glyph + word, never colour alone — the same pairing the rows use. */
const FILTERS: Readonly<
  Record<ReviewFilter, { glyph: string; label: string }>
> = {
  all: { glyph: '', label: 'All' },
  ok: { glyph: '✅', label: 'Ready' },
  warning: { glyph: '⚠', label: 'Warnings' },
  error: { glyph: '⛔', label: 'Errors' },
  duplicate: { glyph: '⧉', label: 'Duplicates' },
}

const countOf = (counts: ReviewCounts, filter: ReviewFilter): number =>
  filter === 'all' ? counts.total : counts[filter]

const ITEM =
  'gap-[6px] rounded-full border border-fp-border px-[11px] py-[6px] text-[12.5px] font-semibold text-fp-text-2 data-[state=on]:border-transparent data-[state=on]:bg-fp-accent-soft data-[state=on]:text-fp-accent-ink'

/** What the file adds up to, and the filters over it. */
export function ReviewSummaryBar({
  counts,
  plan,
  filter,
  onFilter,
  skipDuplicates,
  onSkipDuplicates,
}: Props) {
  const number = new Intl.NumberFormat()

  return (
    <div className="flex flex-col gap-2.5">
      <p aria-live="polite" className="text-[13px] text-fp-text-2">
        {number.format(counts.total)} rows · ✅ {number.format(counts.ok)} ready
        · ⚠ {number.format(counts.warning)} warnings · ⛔{' '}
        {number.format(counts.error)} errors · ⧉{' '}
        {number.format(counts.duplicate)} duplicates
      </p>
      {plan.transfers > 0 ? (
        <p className="text-[12.5px] text-fp-text-3">
          Imports as {planLabel(plan)} — each transfer’s two rows become one
          transfer between your accounts.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ToggleGroup
          type="single"
          value={filter}
          spacing={1.5}
          aria-label="Filter rows"
          className="flex-wrap justify-start"
          onValueChange={(value) => {
            if (value) onFilter(value as ReviewFilter)
          }}
        >
          {REVIEW_FILTERS.map((entry) => (
            <ToggleGroupItem key={entry} value={entry} className={ITEM}>
              {FILTERS[entry].glyph ? (
                <span aria-hidden>{FILTERS[entry].glyph}</span>
              ) : null}
              {FILTERS[entry].label}
              <span className="tabular-nums opacity-70">
                {number.format(countOf(counts, entry))}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <label className="ms-auto flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-fp-text-2">
          <Switch
            checked={skipDuplicates}
            onCheckedChange={onSkipDuplicates}
            aria-label="Skip duplicates"
          />
          <span aria-hidden>⧉</span> Skip duplicates
        </label>
      </div>
    </div>
  )
}
