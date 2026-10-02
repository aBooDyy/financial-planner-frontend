import type { QuickChip } from '#/features/transactions/data/quickChips'
import type { CountsToward } from '#/features/transactions/hooks/useCountsToward'
import type { TxEditorDraft } from '#/features/transactions/hooks/useTxEditor'
import type { DateFormat } from '#/lib/date'
import { CountsTowardRow } from './CountsTowardRow'
import { PlannedLinkBanner } from './PlannedLinkBanner'
import { TxCategoryChips } from './TxCategoryChips'
import { TxDateChips } from './TxDateChips'
import { TxMerchantField } from './TxMerchantField'
import { TxNoteField } from './TxNoteField'
import { TxSection } from './TxSection'

type Props = {
  draft: TxEditorDraft
  chips: ReadonlyArray<QuickChip>
  merchantName: string
  suggestion: string | null
  counts: CountsToward
  dateFormat: DateFormat
  /** The field a refused sync named, while it is still as it was. */
  flaggedField?: string | null
  onField: <TKey extends keyof TxEditorDraft>(
    f: TKey,
    v: TxEditorDraft[TKey],
  ) => void
  onCategory: (categoryId: string) => void
  onApplySuggestion: () => void
  onOpen: (pane: 'category' | 'merchant' | 'counts') => void
}

const HINT =
  'rounded-[11px] bg-fp-surface-2 px-3 py-[10px] text-[12.5px] leading-[1.5] text-fp-text-2'

/** A spend or income entry's body under the amount: what for, a note, when, where, and what it settles. */
export function TxCashflowFields({
  draft,
  chips,
  merchantName,
  suggestion,
  counts,
  dateFormat,
  flaggedField = null,
  onField,
  onCategory,
  onApplySuggestion,
  onOpen,
}: Props) {
  const { face, banner, infoHint } = counts
  return (
    <>
      <TxSection label="What for?" invalid={flaggedField === 'category_id'}>
        <TxCategoryChips
          chips={chips}
          categoryId={draft.categoryId}
          onChange={onCategory}
          onAll={() => onOpen('category')}
        />
      </TxSection>

      <TxNoteField
        value={draft.note}
        onChange={(note) => onField('note', note)}
        kind={draft.type}
        placeholder="Add a note"
      />

      <TxSection label="When?" invalid={flaggedField === 'date'}>
        <TxDateChips
          value={draft.date}
          onChange={(iso) => onField('date', iso)}
          dateFormat={dateFormat}
        />
      </TxSection>

      <TxSection label="Where?" invalid={flaggedField === 'merchant_id'}>
        <TxMerchantField
          name={merchantName}
          onOpen={() => onOpen('merchant')}
          suggestion={suggestion}
          onApplySuggestion={onApplySuggestion}
        />
      </TxSection>

      {face ? (
        <CountsTowardRow
          face={face}
          onOpen={() => onOpen('counts')}
          invalid={flaggedField === 'goal_id' || flaggedField === 'planned_id'}
        />
      ) : null}

      {banner ? (
        <PlannedLinkBanner
          banner={banner}
          onLinked={counts.setLinked}
          onChooseStream={
            counts.isIncome && banner.auto ? () => onOpen('counts') : undefined
          }
        />
      ) : null}

      {infoHint === 'saving-goal' ? (
        <p className={HINT}>
          Counts as spending this goal’s money. To put money aside, use{' '}
          <b className="text-fp-text">Add money</b> on the goal.
        </p>
      ) : null}
      {infoHint === 'no-payday' ? (
        <p className={HINT}>
          No planned payday near this date — it saves as regular income.
        </p>
      ) : null}
    </>
  )
}
