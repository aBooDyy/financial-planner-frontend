import { CurrencyPicker } from '#/components/CurrencyPicker'
import { Input } from '#/components/ui/input'
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
import type { CategoryCatalog } from '#/features/categories/data/catalog'
import type { LocatorField } from '#/features/integrations/api/ruleTypes'
import type { CurrencyCode } from '#/lib/currency'

export type ConstantChoices = {
  walletGroups: WalletGroupOption[]
  catalog: CategoryCatalog
  baseCurrency: CurrencyCode
}

type Props = {
  id: string
  field: LocatorField
  label: string
  value: string
  onChange: (value: string) => void
  describedBy: string
  invalid?: boolean
  choices: ConstantChoices
}

/**
 * A fixed value, picked rather than typed wherever the app knows the choices — the server
 * matches an account by name and a category by slug, so those are what the pickers produce.
 */
export function ConstantInput({
  id,
  field,
  label,
  value,
  onChange,
  describedBy,
  invalid,
  choices,
}: Props) {
  const trigger = (
    <SelectTrigger
      id={id}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid}
    >
      <SelectValue placeholder="Choose…" />
    </SelectTrigger>
  )

  switch (field) {
    case 'currency':
      return (
        <CurrencyPicker
          value={value || choices.baseCurrency}
          onChange={(code) => onChange(code)}
          base={choices.baseCurrency}
          label={label}
        />
      )
    case 'type':
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          {trigger}
          <SelectContent>
            <SelectItem value="SPEND">Spend</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
      )
    case 'wallet':
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          {trigger}
          <SelectContent>
            {choices.walletGroups.map((group) => (
              <SelectGroup key={group.label ?? ''}>
                {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
                {group.wallets.map((w) => (
                  <SelectItem key={w.id} value={w.name}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )
    case 'category':
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          {trigger}
          <SelectContent>
            {choices.catalog.all.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    default:
      return (
        <Input
          id={id}
          dir="auto"
          value={value}
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          maxLength={200}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
