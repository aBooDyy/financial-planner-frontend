import { Merge } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { MergeSuggestion } from '#/features/merchants/data/suggestions'

type Props = {
  suggestions: ReadonlyArray<MergeSuggestion>
  onMerge: (suggestion: MergeSuggestion) => void
}

const CARD =
  'overflow-hidden rounded-2xl border border-fp-accent/35 bg-fp-accent-soft/40 shadow-fp'

/**
 * A bulk import gives one shop a row per branch code. They are only ever offered here —
 * nothing is folded without the merge dialog, which spells out what moves where.
 */
export function MergeSuggestionsCard({ suggestions, onMerge }: Props) {
  if (suggestions.length === 0) return null

  return (
    <section aria-labelledby="merge-suggestions" className={CARD}>
      <div className="flex flex-col gap-0.5 border-b border-fp-accent/25 px-[18px] py-[13px]">
        <h3 id="merge-suggestions" className="text-[13.5px] font-bold">
          {suggestions.length === 1
            ? 'One of these looks like a duplicate'
            : `${suggestions.length} of these look like duplicates`}
        </h3>
        <p className="text-[12.5px] text-fp-text-2">
          Importing a statement can give one shop a row per branch. Merging
          keeps every transaction and every spelling.
        </p>
      </div>

      <ul>
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.source.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-fp-accent/20 px-[18px] py-[11px] last:border-0"
          >
            <p className="min-w-0 flex-1 text-[13px] text-fp-text-2">
              <span className="font-semibold text-fp-text">
                “{suggestion.source.displayName}”
              </span>{' '}
              looks like{' '}
              <span className="font-semibold text-fp-text">
                “{suggestion.target.displayName}”
              </span>
              {suggestion.sourceSpelling !== suggestion.source.displayName ||
              suggestion.targetSpelling !== suggestion.target.displayName ? (
                <span className="text-fp-text-3">
                  {' '}
                  — “{suggestion.sourceSpelling}” against “
                  {suggestion.targetSpelling}”
                </span>
              ) : null}
            </p>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-1.5 px-[13px] py-[8px] text-[12.5px]"
              onClick={() => onMerge(suggestion)}
            >
              <Merge size={14} strokeWidth={1.9} aria-hidden />
              Review merge
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
