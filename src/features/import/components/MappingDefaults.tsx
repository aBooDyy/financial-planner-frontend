import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { AccountSelect } from '#/features/transactions/components/AccountSelect'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import type { CategoryOption } from '#/features/import/data/matching'
import type { MappingDefaults as Defaults } from '#/features/import/data/types'
import type { TxType } from '#/features/transactions/api/types'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  defaults: Defaults
  walletGroups: ReadonlyArray<WalletGroupOption>
  categories: ReadonlyArray<CategoryOption>
  baseCurrency: CurrencyCode
  onChange: (patch: Partial<Defaults>) => void
}

const LABEL = 'mb-[6px] block text-[11.5px] font-semibold text-fp-text-2'

const CATEGORY_LABEL: Readonly<Record<TxType, string>> = {
  spend: 'Category for money out when the file says none',
  income: 'Category for money in when the file says none',
}

/** What a row falls back to when the file itself says nothing. */
export function MappingDefaults({
  defaults,
  walletGroups,
  categories,
  baseCurrency,
  onChange,
}: Props) {
  const setCategory = (type: TxType, id: string) =>
    onChange({ categoryIds: { ...defaults.categoryIds, [type]: id } })

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label className={LABEL} htmlFor="default-wallet">
          Account for rows with none
        </Label>
        <AccountSelect
          id="default-wallet"
          value={defaults.walletId}
          onChange={(walletId) => onChange({ walletId: walletId || null })}
          wallets={walletGroups.flatMap((group) => group.wallets)}
          noneLabel="No account"
        />
      </div>

      <div>
        <Label className={LABEL}>Currency when the file says none</Label>
        <CurrencyPicker
          value={defaults.currency}
          base={baseCurrency}
          onChange={(currency) => onChange({ currency })}
        />
      </div>

      {(['spend', 'income'] as const).map((type) => (
        <div key={type}>
          <Label className={LABEL} htmlFor={`default-category-${type}`}>
            {CATEGORY_LABEL[type]}
          </Label>
          <Select
            value={defaults.categoryIds[type]}
            onValueChange={(id) => setCategory(type, id)}
          >
            <SelectTrigger id={`default-category-${type}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((option) => option.type === type)
                .map((option) => (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    className={option.parentId === null ? undefined : 'ps-8'}
                  >
                    {option.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}
