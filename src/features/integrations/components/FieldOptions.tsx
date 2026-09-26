import { Plus, X } from 'lucide-react'
import { FieldLabel } from '#/components/FieldLabel'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type {
  AmountSign,
  AmountUnit,
  DateFormat,
  Locator,
  LocatorField,
  MappedType,
} from '#/features/integrations/api/ruleTypes'
import { DATE_FORMAT_LABEL } from '#/features/integrations/data/fieldStatus'

type Props = {
  id: string
  field: LocatorField
  locator: Locator
  onChange: (locator: Locator) => void
}

const UNITS: { value: AmountUnit; label: string }[] = [
  { value: 'MAJOR', label: 'As written (152.75)' },
  { value: 'MINOR', label: 'In cents (15275)' },
]

const SIGNS: { value: AmountSign; label: string }[] = [
  { value: 'ABSOLUTE', label: 'Ignore the sign' },
  { value: 'SIGNED', label: 'Minus is spending' },
]

const FORMATS = Object.entries(DATE_FORMAT_LABEL) as [DateFormat, string][]

/** The options that only mean something on one field: amount's unit and sign, date's layout, type's map. */
export function FieldOptions({ id, field, locator, onChange }: Props) {
  if (field === 'amount') {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <OptionSelect
          id={`${id}-unit`}
          label="Amount is"
          value={locator.unit ?? 'MAJOR'}
          options={UNITS}
          onChange={(unit) => onChange({ ...locator, unit })}
        />
        <OptionSelect
          id={`${id}-sign`}
          label="A minus sign"
          value={locator.sign ?? 'ABSOLUTE'}
          options={SIGNS}
          onChange={(sign) => onChange({ ...locator, sign })}
        />
      </div>
    )
  }
  if (field === 'date') {
    return (
      <OptionSelect
        id={`${id}-format`}
        label="Written as"
        value={locator.format ?? 'ISO'}
        options={FORMATS.map(([value, label]) => ({ value, label }))}
        onChange={(format) => onChange({ ...locator, format })}
      />
    )
  }
  if (field === 'type') {
    return <TypeMap id={id} locator={locator} onChange={onChange} />
  }
  return null
}

function OptionSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Which payload words mean spending and which mean income. */
function TypeMap({
  id,
  locator,
  onChange,
}: {
  id: string
  locator: Locator
  onChange: (locator: Locator) => void
}) {
  const entries = Object.entries(locator.map ?? {})
  const write = (next: [string, MappedType][]) =>
    onChange({ ...locator, map: Object.fromEntries(next) })

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-2 text-[13px] font-bold text-fp-text-2">
        When the payload says…
      </legend>
      {entries.map(([word, type], i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            dir="auto"
            value={word}
            aria-label={`Payload word ${i + 1}`}
            onChange={(e) =>
              write(
                entries.map((entry, j) =>
                  j === i ? [e.target.value, type] : entry,
                ),
              )
            }
            className="min-w-0 flex-1"
          />
          <Select
            value={type}
            onValueChange={(v) =>
              write(
                entries.map((entry, j) =>
                  j === i ? [word, v as MappedType] : entry,
                ),
              )
            }
          >
            <SelectTrigger
              id={`${id}-map-${i}`}
              aria-label={`Type for payload word ${i + 1}`}
              className="w-[118px] shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SPEND">Spend</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            aria-label={`Remove payload word ${i + 1}`}
            onClick={() => write(entries.filter((_, j) => j !== i))}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-fp-border text-fp-text-3 transition hover:border-fp-border-strong hover:text-fp-text"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={entries.some(([word]) => !word.trim())}
        onClick={() => write([...entries, ['', 'SPEND']])}
        className="inline-flex items-center gap-1 self-start text-[12.5px] font-bold text-fp-accent-ink hover:underline disabled:opacity-50 disabled:hover:no-underline"
      >
        <Plus size={13} strokeWidth={2.2} />
        Add a word
      </button>
    </fieldset>
  )
}
