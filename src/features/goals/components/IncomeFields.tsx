import type { LocalBalanceNode } from '#/db/types'
import { TextField } from '#/components/TextField'
import { startOfToday } from '#/features/goals/data/planning'
import type { EditorDraft } from '#/features/goals/hooks/useGoalEditor'
import { usePreferencesStore } from '#/stores/preferences'
import { ColourField } from './ColourField'
import { DepositWalletField } from './DepositWalletField'
import { EditorAmount } from './EditorAmount'
import { FrequencyChips } from './FrequencyChips'
import { IncomePaydayField } from './IncomePaydayField'

type Props = {
  draft: EditorDraft
  nodes: LocalBalanceNode[]
  onField: <TKey extends keyof EditorDraft>(
    field: TKey,
    value: EditorDraft[TKey],
  ) => void
}

/** The income editor's body: where it comes from, how much, when, and where it lands. */
export function IncomeFields({ draft, nodes, onField }: Props) {
  const dateFormat = usePreferencesStore((s) => s.dateFormat)

  return (
    <>
      <TextField
        id="income-source"
        label="Where does it come from?"
        optional
        value={draft.name}
        onChange={(e) => onField('name', e.target.value)}
        placeholder="e.g. Salary, Freelance"
      />

      <EditorAmount
        question="How much each time?"
        amount={draft.amount}
        currency={draft.currency}
        onAmount={(v) => onField('amount', v)}
        onCurrency={(code) => onField('currency', code)}
      />

      <FrequencyChips
        value={draft.frequency}
        onChange={(f) => onField('frequency', f)}
      />

      <IncomePaydayField
        draft={draft}
        today={startOfToday()}
        dateFormat={dateFormat}
        onDay={(day) => onField('day', day)}
        onNextPayday={(iso) => {
          onField('anchorISO', iso)
          onField('day', String(Number(iso.slice(8, 10))))
        }}
      />

      <DepositWalletField
        value={draft.walletId}
        nodes={nodes}
        onChange={(v) => onField('walletId', v)}
      />

      <ColourField value={draft.color} onChange={(c) => onField('color', c)} />
    </>
  )
}
