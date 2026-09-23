import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Switch } from '#/components/ui/switch'
import type { WalletGroupOption } from '#/features/balances/data/selectors'
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_MIN,
} from '#/features/integrations/data/draft'
import { KEY_NAME_MAX } from '#/features/integrations/hooks/useCreateKeyForm'
import type { KeyEditor } from '#/features/integrations/hooks/useKeyEditor'
import { Segmented } from '#/features/settings/components/Segmented'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'
import { ExpiryField } from './ExpiryField'
import { FormRow } from './FormRow'
import { WalletSelect } from './WalletSelect'

const NONE = '__none__'

const TYPES: { value: TxType; label: string }[] = [
  { value: 'spend', label: 'Spend' },
  { value: 'income', label: 'Income' },
]

const NEEDS_WALLET =
  'Choose a default account first — Means needs to know which account to post to.'

type Props = {
  editor: KeyEditor
  walletGroups: WalletGroupOption[]
  catalog: CategoryCatalog
  baseCurrency: CurrencyCode
}

/** Everything a key does when no rule says otherwise. Presentation only. */
export function KeySettingsForm({
  editor,
  walletGroups,
  catalog,
  baseCurrency,
}: Props) {
  const { draft, set, errorFor } = editor
  const categories = catalog.byType(draft.defaultType)
  const subs = draft.defaultCategory
    ? catalog.subsOf(draft.defaultCategory)
    : []
  const noWallet = draft.defaultWalletId === null
  const autoConfirmError = errorFor('autoConfirm')
  const rateError = errorFor('rateLimitPerMinute')

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-col items-start">
        <span
          id="key-type-label"
          className="mb-[6px] text-[12.5px] font-semibold text-fp-text-2"
        >
          Default type
        </span>
        <div role="group" aria-labelledby="key-type-label">
          <Segmented
            value={draft.defaultType}
            options={TYPES}
            onChange={(v) => set('defaultType', v)}
          />
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${subs.length > 0 ? 'sm:grid-cols-2' : ''}`}
      >
        <FormRow id="key-category" label="Default category">
          <Select
            value={draft.defaultCategory ?? NONE}
            onValueChange={(v) => set('defaultCategory', v === NONE ? null : v)}
          >
            <SelectTrigger id="key-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Decide when reviewing</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
        {subs.length > 0 ? (
          <FormRow id="key-subcategory" label="Subcategory">
            <Select
              value={draft.defaultSubcategory ?? NONE}
              onValueChange={(v) =>
                set('defaultSubcategory', v === NONE ? null : v)
              }
            >
              <SelectTrigger id="key-subcategory" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {subs.map((s) => (
                  <SelectItem key={s.slug} value={s.slug}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormRow>
        ) : null}
      </div>

      <FormRow
        id="key-currency"
        label="Default currency"
        error={errorFor('defaultCurrency')}
        help="Used when what arrives doesn’t say."
      >
        {draft.defaultCurrency === null ? (
          <Button
            id="key-currency"
            type="button"
            variant="outline"
            onClick={() => set('defaultCurrency', baseCurrency)}
            className="justify-start bg-fp-surface-2 px-[13px] py-3 text-[14px] font-normal text-fp-text-3"
          >
            Not set — add one
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <CurrencyPicker
              value={draft.defaultCurrency}
              onChange={(code) => set('defaultCurrency', code)}
              base={baseCurrency}
              label="Default currency"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => set('defaultCurrency', null)}
              aria-label="Clear default currency"
              className="h-[46px] w-[46px] shrink-0 rounded-xl text-fp-text-3"
            >
              <X size={16} strokeWidth={2} />
            </Button>
          </div>
        )}
      </FormRow>

      <div className="flex flex-col overflow-hidden rounded-xl border border-fp-border">
        <SwitchRow
          id="key-auto-confirm"
          label="Post without review"
          desc={
            autoConfirmError ??
            (noWallet
              ? NEEDS_WALLET
              : 'Complete transactions go straight to your ledger.')
          }
          invalid={Boolean(autoConfirmError)}
        >
          <Switch
            id="key-auto-confirm"
            checked={draft.autoConfirm}
            onCheckedChange={(on) => set('autoConfirm', on)}
            disabled={noWallet && !draft.autoConfirm}
            aria-describedby="key-auto-confirm-desc"
          />
        </SwitchRow>
        <SwitchRow
          id="key-stage-unmatched"
          label="Keep payloads I can’t read"
          desc="When nothing matches, save what was sent so you can finish it by hand."
        >
          <Switch
            id="key-stage-unmatched"
            checked={draft.stageUnmatched}
            onCheckedChange={(on) => set('stageUnmatched', on)}
            aria-describedby="key-stage-unmatched-desc"
          />
        </SwitchRow>
      </div>

      <FormRow
        id="key-rate"
        label="Rate limit"
        error={rateError}
        help={`Requests a minute, ${RATE_LIMIT_MIN}–${RATE_LIMIT_MAX}. A safety rail for an app stuck retrying.`}
      >
        <div className="flex items-center gap-2">
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
            className="w-[110px] text-start tabular-nums"
          />
          <span className="text-[13px] text-fp-text-2">per minute</span>
        </div>
      </FormRow>
    </div>
  )
}

function SwitchRow({
  id,
  label,
  desc,
  invalid,
  children,
}: {
  id: string
  label: string
  desc: string
  invalid?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-4 border-b border-fp-border px-[14px] py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-[14px] font-semibold">
          {label}
        </label>
        <div
          id={`${id}-desc`}
          className={`mt-0.5 text-[12px] ${invalid ? 'text-fp-danger' : 'text-fp-text-3'}`}
        >
          {desc}
        </div>
      </div>
      {children}
    </div>
  )
}
