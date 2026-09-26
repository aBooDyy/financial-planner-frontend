import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { WalletGroupOption } from '#/features/wallets/data/selectors'
import type { CategoryOption } from '#/features/import/data/matching'
import type { MappingDefaults as Defaults } from '#/features/import/data/types'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  defaults: Defaults
  walletGroups: ReadonlyArray<WalletGroupOption>
  categories: ReadonlyArray<CategoryOption>
  baseCurrency: CurrencyCode
  onChange: (patch: Partial<Defaults>) => void
}

const NO_WALLET = 'none'
const LABEL = 'mb-[6px] block text-[11.5px] font-semibold text-fp-text-2'

/** What a row falls back to when the file itself says nothing. */
export function MappingDefaults({
  defaults,
  walletGroups,
  categories,
  baseCurrency,
  onChange,
}: Props) {
  const parents = categories.filter((option) => option.subcategory === null)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <Label className={LABEL} htmlFor="default-wallet">
          Account for rows with none
        </Label>
        <Select
          value={defaults.walletId ?? NO_WALLET}
          onValueChange={(value) =>
            onChange({ walletId: value === NO_WALLET ? null : value })
          }
        >
          <SelectTrigger id="default-wallet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_WALLET}>No account</SelectItem>
            {walletGroups.map((group, index) => (
              <SelectGroup key={group.label ?? `root-${index}`}>
                {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
                {group.wallets.map((wallet) => (
                  <SelectItem key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className={LABEL}>Currency when the file says none</Label>
        <CurrencyPicker
          value={defaults.currency}
          base={baseCurrency}
          onChange={(currency) => onChange({ currency })}
        />
      </div>

      <div>
        <Label className={LABEL} htmlFor="default-category">
          Category when the file says none
        </Label>
        <Select
          value={defaults.category}
          onValueChange={(category) =>
            onChange({ category, subcategory: null })
          }
        >
          <SelectTrigger id="default-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {parents.map((option) => (
              <SelectItem key={option.category} value={option.category}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
