import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import type { TextRule } from '#/features/integrations/api/ruleTypes'
import type { TextRulePatch } from '#/features/integrations/data/ruleEditorState'
import type { RuleProblem } from '#/features/integrations/data/ruleErrors'
import type { TxType } from '#/features/transactions/api/types'
import { WalletSelect } from '#/features/wallets/components/WalletSelect'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'

const TYPES: { value: TxType; label: string }[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
]

const DEFAULT_MERCHANT_MAX = 200

type Props = {
  text: TextRule
  walletGroups: WalletGroupOption[]
  onEdit: (patch: TextRulePatch) => void
  problem: RuleProblem | null
}

/**
 * Where this rule's messages go. Left empty, the account and category fall back to the key's
 * defaults; whether they post without review is the key's setting.
 */
export function TextRoutingForm({
  text,
  walletGroups,
  onEdit,
  problem,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <FormRow
          id="text-rule-wallet"
          label="Account"
          error={problem?.walletId}
          help="Where these transactions are filed."
        >
          <WalletSelect
            id="text-rule-wallet"
            value={text.walletId}
            onChange={(walletId) => onEdit({ walletId })}
            walletGroups={walletGroups}
            noneLabel="The key’s default account"
            invalid={Boolean(problem?.walletId)}
          />
        </FormRow>
        <div className="min-w-0">
          <FieldLabel>These messages are</FieldLabel>
          <PillSwitch
            label="These messages are"
            value={text.type}
            options={TYPES}
            onChange={(type) => onEdit({ type })}
            color={
              text.type === 'spend' ? 'var(--fp-spend)' : 'var(--fp-accent-ink)'
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <FormRow
          id="text-rule-category"
          label="Category"
          error={problem?.categoryId}
        >
          <CategoryPicker
            id="text-rule-category"
            type={text.type}
            categoryId={text.categoryId}
            onChange={(categoryId) => onEdit({ categoryId })}
            none={{
              label: 'The key’s default',
              onPick: () => onEdit({ categoryId: null }),
            }}
            invalid={Boolean(problem?.categoryId)}
          />
        </FormRow>
        <FormRow
          id="text-rule-default-merchant"
          label="Default merchant"
          optional
          error={problem?.defaultMerchant}
          help="Used when a message has no merchant."
        >
          <Input
            id="text-rule-default-merchant"
            value={text.defaultMerchant}
            maxLength={DEFAULT_MERCHANT_MAX}
            placeholder="e.g. Card purchase"
            onChange={(e) => onEdit({ defaultMerchant: e.target.value })}
          />
        </FormRow>
      </div>
    </div>
  )
}
