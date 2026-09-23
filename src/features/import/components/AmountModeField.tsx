import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import type { TxType } from '#/features/transactions/api/types'
import type { AmountKind } from '#/features/import/data/mapping'
import type { AmountUnit } from '#/features/import/data/types'

type Props = {
  amountKind: AmountKind
  negativeMeans: TxType
  amountUnit: AmountUnit
  onKindChange: (kind: AmountKind) => void
  onNegativeMeansChange: (type: TxType) => void
  onUnitChange: (unit: AmountUnit) => void
}

const KINDS: ReadonlyArray<{ kind: AmountKind; label: string }> = [
  { kind: 'split', label: 'Separate in / out columns' },
  { kind: 'signed', label: 'One signed column' },
  { kind: 'typed', label: 'Amount + a type column' },
]

const SIGNS: ReadonlyArray<{ type: TxType; label: string }> = [
  { type: 'spend', label: 'Money out' },
  { type: 'income', label: 'Money in' },
]

const LABEL = 'mb-[6px] block text-[11.5px] font-semibold text-fp-text-2'

const RADIO =
  'flex cursor-pointer items-center gap-2 rounded-lg border px-[11px] py-[7px] text-[12.5px] font-semibold transition'

/**
 * How the file writes money. The unit sits here too: it is detected from the header, but a
 * file whose amounts are already in minor units is 100× off if the guess is wrong, so it is
 * always visible and always overridable.
 */
export function AmountModeField({
  amountKind,
  negativeMeans,
  amountUnit,
  onKindChange,
  onNegativeMeansChange,
  onUnitChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className={LABEL}>How are amounts written?</Label>
        <ToggleGroup
          type="single"
          value={amountKind}
          spacing={1}
          variant="outline"
          aria-label="Amount columns"
          className="flex-wrap justify-start"
          onValueChange={(value) => {
            if (value) onKindChange(value as AmountKind)
          }}
        >
          {KINDS.map((option) => (
            <ToggleGroupItem
              key={option.kind}
              value={option.kind}
              className="rounded-lg text-[12.5px] data-[state=on]:bg-fp-accent-soft data-[state=on]:text-fp-accent-ink"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {amountKind === 'signed' ? (
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className={LABEL}>A negative number means</legend>
          {SIGNS.map((option) => {
            const selected = option.type === negativeMeans
            return (
              <label
                key={option.type}
                className={`${RADIO} ${
                  selected
                    ? 'border-fp-accent bg-fp-accent-soft text-fp-accent-ink'
                    : 'border-fp-border bg-fp-surface text-fp-text-2'
                }`}
              >
                <input
                  type="radio"
                  name="negative-means"
                  className="sr-only"
                  checked={selected}
                  value={option.type}
                  onChange={() => onNegativeMeansChange(option.type)}
                />
                {option.label}
              </label>
            )
          })}
        </fieldset>
      ) : null}

      <div className="max-w-[320px]">
        <Label className={LABEL} htmlFor="amount-unit">
          Amounts are written as
        </Label>
        <Select
          value={amountUnit}
          onValueChange={(value) => onUnitChange(value as AmountUnit)}
        >
          <SelectTrigger id="amount-unit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="major">Normal — 142.50</SelectItem>
            <SelectItem value="minor">Minor units — 14250</SelectItem>
          </SelectContent>
        </Select>
        {amountUnit === 'minor' ? (
          <p className="mt-[6px] text-[12px] text-fp-text-3">
            Every amount is divided by the currency’s decimals. Our own export
            writes this way.
          </p>
        ) : null}
      </div>
    </div>
  )
}
