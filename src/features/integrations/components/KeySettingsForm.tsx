import { Plus, X } from 'lucide-react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { ToggleCard } from '#/components/dialog/ToggleCard'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage, FormRow } from '#/components/FormRow'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { WalletSelect } from '#/features/wallets/components/WalletSelect'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import { CategoryPicker } from '#/features/categories/components/CategoryPicker'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_MIN,
} from '#/features/integrations/data/draft'
import { KEY_NAME_MAX } from '#/features/integrations/hooks/useCreateKeyForm'
import type { KeyEditor } from '#/features/integrations/hooks/useKeyEditor'
import type { TxType } from '#/features/transactions/api/types'
import { TYPE_TINT } from '#/features/transactions/data/txDialog'
import type { CurrencyCode } from '#/lib/currency'
import { ExpiryField } from './ExpiryField'

const TYPES = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
] as const

const NEEDS_WALLET =
  'Choose a default account first — Means needs to know which account to post to.'

type Props = {
  editor: KeyEditor
  walletGroups: WalletGroupOption[]
  baseCurrency: CurrencyCode
}

/** Everything a key does when no rule says otherwise. Presentation only. */
export function KeySettingsForm({ editor, walletGroups, baseCurrency }: Props) {
  const { draft, set, errorFor } = editor
  const noWallet = draft.defaultWalletId === null
  const rateError = errorFor('rateLimitPerMinute')

  return (
    <section
      aria-labelledby="key-settings-heading"
      className="flex flex-col gap-[14px]"
    >
      <h3 id="key-settings-heading" className="text-[15px] font-extrabold">
        Settings
      </h3>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <FormRow id="key-name" label="Name" error={errorFor('name')}>
          <Input
            id="key-name"
            value={draft.name}
            maxLength={KEY_NAME_MAX}
            aria-invalid={errorFor('name') ? true : undefined}
            onChange={(e) => set('name', e.target.value)}
          />
        </FormRow>
        <FormRow id="key-expiry" label="Expires" error={errorFor('expiresAt')}>
          <ExpiryField
            id="key-expiry"
            value={draft.expiresAt}
            onChange={(v) => set('expiresAt', v)}
            invalid={Boolean(errorFor('expiresAt'))}
          />
        </FormRow>
      </div>

      <FormRow
        id="key-wallet"
        label="Default account"
        error={errorFor('defaultWalletId')}
      >
        <WalletSelect
          id="key-wallet"
          value={draft.defaultWalletId}
          onChange={(v) => set('defaultWalletId', v)}
          walletGroups={walletGroups}
          invalid={Boolean(errorFor('defaultWalletId'))}
        />
      </FormRow>

      <div className="flex flex-col">
        <FieldLabel>Default type</FieldLabel>
        <PillSwitch<TxType>
          label="Default type"
          options={TYPES}
          value={draft.defaultType}
          onChange={(v) => set('defaultType', v)}
          color={TYPE_TINT[draft.defaultType].ink}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <FormRow
          id="key-category"
          label="Default category"
          error={errorFor('defaultCategoryId')}
        >
          <CategoryPicker
            id="key-category"
            type={draft.defaultType}
            categoryId={draft.defaultCategoryId}
            onChange={(v) => set('defaultCategoryId', v)}
            none={{
              label: 'Decide when reviewing',
              onPick: () => set('defaultCategoryId', null),
            }}
            invalid={Boolean(errorFor('defaultCategoryId'))}
          />
        </FormRow>
        <FormRow
          id="key-currency"
          label="Default currency"
          error={errorFor('defaultCurrency')}
          help="Used when what arrives doesn’t say."
        >
          <DefaultCurrency
            value={draft.defaultCurrency}
            baseCurrency={baseCurrency}
            onChange={(code) => set('defaultCurrency', code)}
          />
        </FormRow>
      </div>

      <div className="flex flex-col">
        <ToggleCard
          title="Post without review"
          description={
            noWallet
              ? NEEDS_WALLET
              : 'Complete transactions go straight to your ledger.'
          }
          checked={draft.autoConfirm}
          onCheckedChange={(on) => set('autoConfirm', on)}
          disabled={noWallet && !draft.autoConfirm}
        />
        <FieldMessage error={errorFor('autoConfirm')} />
      </div>
      <ToggleCard
        title="Keep payloads I can’t read"
        description="When nothing matches, save what was sent so you can finish it by hand."
        checked={draft.stageUnmatched}
        onCheckedChange={(on) => set('stageUnmatched', on)}
      />

      <FormRow
        id="key-rate"
        label="Rate limit"
        error={rateError}
        help={`Requests a minute, ${RATE_LIMIT_MIN}–${RATE_LIMIT_MAX}. A safety rail for an app stuck retrying.`}
      >
        <div className="flex items-center gap-[10px]">
          <Input
            id="key-rate"
            type="number"
            inputMode="numeric"
            min={RATE_LIMIT_MIN}
            max={RATE_LIMIT_MAX}
            dir="ltr"
            value={
              Number.isNaN(draft.rateLimitPerMinute)
                ? ''
                : draft.rateLimitPerMinute
            }
            aria-invalid={rateError ? true : undefined}
            onChange={(e) => set('rateLimitPerMinute', e.target.valueAsNumber)}
            className="w-[88px] text-center tabular-nums"
          />
          <span className="text-[13px] font-semibold text-fp-text-2">
            per minute
          </span>
        </div>
      </FormRow>
    </section>
  )
}

/** A key can leave the currency to whatever arrives, so "not set" is a real answer here. */
function DefaultCurrency({
  value,
  baseCurrency,
  onChange,
}: {
  value: CurrencyCode | null
  baseCurrency: CurrencyCode
  onChange: (code: CurrencyCode | null) => void
}) {
  if (value === null) {
    return (
      <button
        id="key-currency"
        type="button"
        onClick={() => onChange(baseCurrency)}
        className="flex w-full items-center gap-1 rounded-[14px] border-[1.5px] border-fp-border bg-fp-surface-2 px-[14px] py-3 text-start text-[13px] font-bold text-fp-accent-ink transition outline-none hover:border-fp-border-strong focus-visible:border-fp-accent focus-visible:ring-[3px] focus-visible:ring-fp-accent/15"
      >
        <Plus aria-hidden size={14} strokeWidth={2.4} />
        Not set — add one
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <CurrencyPicker
        value={value}
        onChange={(code) => onChange(code)}
        base={baseCurrency}
        label="Default currency"
        className="min-w-0 flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onChange(null)}
        aria-label="Clear default currency"
        className="size-[46px] shrink-0 rounded-[14px] text-fp-text-3"
      >
        <X size={16} strokeWidth={2} />
      </Button>
    </div>
  )
}
