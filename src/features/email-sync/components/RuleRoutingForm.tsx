import { PillSwitch } from '#/components/dialog/PillSwitch'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage, FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { WalletSelect } from '#/features/wallets/components/WalletSelect'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import { SuggestedCategorySelect } from '#/features/categories/components/SuggestedCategorySelect'
import { RULE_NAME_MAX } from '#/features/email-sync/data/ruleDraft'
import type { RuleDraft } from '#/features/email-sync/data/ruleDraft'
import type { RuleSettingsPatch } from '#/features/email-sync/data/ruleEditorState'
import type { RuleProblem } from '#/features/email-sync/data/ruleErrors'
import type { TxType } from '#/features/transactions/api/types'

const TYPES: { value: TxType; label: string }[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
]

type Props = {
  draft: RuleDraft
  walletGroups: WalletGroupOption[]
  catalog: CategoryCatalog
  onEdit: (patch: RuleSettingsPatch) => void
  /** What the last save said about this rule. */
  problem?: RuleProblem
  nameError?: string
}

/** Where this rule's emails go: the account, the type and category, and whether they post. */
export function RuleRoutingForm({
  draft,
  walletGroups,
  catalog,
  onEdit,
  problem,
  nameError,
}: Props) {
  const noWallet = draft.walletId === null
  const autoConfirmError = problem?.autoConfirm

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <FormRow
          id="rule-name"
          label="Name"
          optional
          error={nameError ?? problem?.name}
        >
          <Input
            id="rule-name"
            value={draft.name}
            maxLength={RULE_NAME_MAX}
            placeholder={draft.filter.senders[0] ?? 'Card purchases'}
            onChange={(e) => onEdit({ name: e.target.value })}
          />
        </FormRow>
        <FormRow
          id="rule-wallet"
          label="Account"
          error={problem?.walletId}
          help="Where these transactions are filed."
        >
          <WalletSelect
            id="rule-wallet"
            value={draft.walletId}
            onChange={(walletId) => onEdit({ walletId })}
            walletGroups={walletGroups}
            noneLabel="Choose when reviewing"
            invalid={Boolean(problem?.walletId)}
          />
        </FormRow>
      </div>

      <div className="min-w-0">
        <FieldLabel>These emails are</FieldLabel>
        <PillSwitch
          label="These emails are"
          value={draft.type}
          options={TYPES}
          onChange={(type) => onEdit({ type })}
          color={
            draft.type === 'spend' ? 'var(--fp-spend)' : 'var(--fp-accent-ink)'
          }
        />
      </div>

      <FormRow id="rule-category" label="Category" error={problem?.category}>
        <SuggestedCategorySelect
          id="rule-category"
          type={draft.type}
          catalog={catalog}
          value={draft.categoryId}
          onChange={(categoryId) => onEdit({ categoryId })}
          invalid={Boolean(problem?.category)}
        />
      </FormRow>

      <div className="min-w-0">
        <ToggleCard
          title="Post without review"
          description={
            noWallet
              ? 'Choose an account first — Means needs to know where to post.'
              : 'Emails read in full go straight to your ledger. A merchant you’ve filed differently still waits for you.'
          }
          checked={draft.autoConfirm}
          onCheckedChange={(autoConfirm) => onEdit({ autoConfirm })}
          disabled={noWallet && !draft.autoConfirm}
        />
        <FieldMessage error={autoConfirmError} />
      </div>
      <ToggleCard
        title="Rule is on"
        description="A paused rule reads nothing; its emails fall to the next rule."
        checked={draft.enabled}
        onCheckedChange={(enabled) => onEdit({ enabled })}
      />
    </div>
  )
}
