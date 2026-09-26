import { useState } from 'react'
import { DialogActions } from '#/components/dialog/DialogActions'
import { FormRow } from '#/components/FormRow'
import { Input } from '#/components/ui/input'
import { ResponsiveDialog } from '#/components/ui/responsive-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import type { CustomCurrencyDraft } from '#/features/settings/data/mutations'
import { isSupportedCurrency } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { messageForApiError } from '#/lib/errorMessages'
import { numericInputProps } from '#/lib/numericInput'

/** The exponents ISO-4217 itself uses; anything else can't round-trip through minor units. */
const MINOR_UNITS = [
  { value: 0, label: 'None — whole units (like JPY)' },
  { value: 2, label: 'Two (like USD)' },
  { value: 3, label: 'Three (like KWD)' },
]

export type CustomCurrencyValues = CustomCurrencyDraft & { perBase: number }

type Props = {
  base: CurrencyCode
  /** Editing an existing currency: its code and minor unit are fixed and shown read-only. */
  initial?: CustomCurrencyValues
  /** Codes already in use, so a clash is caught before the request. */
  takenCodes: string[]
  onSubmit: (values: CustomCurrencyValues) => Promise<void>
  onClose: () => void
}

const CODE_PATTERN = /^[A-Za-z]{3}$/

function codeProblem(upper: string, takenCodes: string[]): string | null {
  if (!CODE_PATTERN.test(upper)) return 'Use exactly three letters.'
  if (isSupportedCurrency(upper))
    return `${upper} is a standard currency already.`
  if (takenCodes.includes(upper))
    return `You already have a currency called ${upper}.`
  return null
}

/**
 * Define a currency the ISO table doesn't carry — loyalty points, a metal, a local unit.
 * Three letters, because every stored amount references a code that wide, and a rate the
 * user supplies: nothing publishes one for a currency only they use.
 */
export function CustomCurrencyDialog({
  base,
  initial,
  takenCodes,
  onSubmit,
  onClose,
}: Props) {
  const editing = initial !== undefined
  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [symbol, setSymbol] = useState(initial?.symbol ?? '')
  const [minorUnit, setMinorUnit] = useState(initial?.minorUnit ?? 2)
  const [rate, setRate] = useState(initial ? String(initial.perBase) : '')
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upper = code.trim().toUpperCase()
  const perBase = Number(rate.replace(/[\s,]/g, ''))
  const codeError = editing ? null : codeProblem(upper, takenCodes)
  const nameError = name.trim() === '' ? 'Give it a name.' : null
  const symbolError = symbol.trim() === '' ? 'Give it a symbol.' : null
  const rateError =
    Number.isFinite(perBase) && perBase > 0 ? null : 'Enter a rate above zero.'
  const valid = !codeError && !nameError && !symbolError && !rateError
  // The code explains itself as it's typed; the rest wait for a first try at saving.
  const shown = (message: string | null) => (tried ? message : null)

  const submit = () => {
    if (busy) return
    if (!valid) {
      setTried(true)
      return
    }
    setBusy(true)
    setError(null)
    void onSubmit({ code: upper, name, symbol, minorUnit, perBase })
      .then(onClose)
      .catch((e: unknown) => {
        setError(messageForApiError(e))
        setBusy(false)
      })
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title={editing ? `Edit ${initial.code}` : 'Add a currency'}
      description={
        editing ? undefined : 'For points, metals or anything else you track.'
      }
      footer={
        <DialogActions
          onCancel={onClose}
          submitLabel={
            busy ? 'Saving…' : editing ? 'Save changes' : 'Add currency'
          }
          onSubmit={submit}
          ready={valid}
          disabled={busy}
        />
      }
      contentClassName="sm:max-w-[430px]"
    >
      <FormRow
        id="cc-code"
        label="Code"
        error={upper === '' ? shown(codeError) : codeError}
        help={
          editing
            ? 'Fixed — money is already stored against it.'
            : 'Three letters, and not one ISO-4217 already uses.'
        }
      >
        <Input
          id="cc-code"
          value={editing ? initial.code : code}
          disabled={editing}
          maxLength={3}
          autoCapitalize="characters"
          placeholder="PTS"
          aria-invalid={!!codeError && (tried || upper !== '')}
          onChange={(e) => setCode(e.target.value)}
          className="uppercase"
        />
      </FormRow>

      <div className="grid grid-cols-[minmax(0,1fr)_110px] items-start gap-3">
        <FormRow id="cc-name" label="Name" error={shown(nameError)}>
          <Input
            id="cc-name"
            value={name}
            placeholder="Airline points"
            aria-invalid={!!shown(nameError)}
            onChange={(e) => setName(e.target.value)}
          />
        </FormRow>
        <FormRow id="cc-symbol" label="Symbol" error={shown(symbolError)}>
          <Input
            id="cc-symbol"
            value={symbol}
            maxLength={8}
            placeholder="pts"
            aria-invalid={!!shown(symbolError)}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </FormRow>
      </div>

      <FormRow
        id="cc-decimals"
        label="Decimal places"
        help={
          editing
            ? `Fixed — every amount held in ${initial.code} is already scaled by it.`
            : undefined
        }
      >
        <Select
          value={String(minorUnit)}
          onValueChange={(v) => setMinorUnit(Number(v))}
          disabled={editing}
        >
          <SelectTrigger id="cc-decimals" aria-label="Decimal places">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINOR_UNITS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormRow>

      <FormRow
        id="cc-rate"
        label={`What’s 1 ${upper || 'unit'} worth?`}
        error={shown(rateError)}
        help="Nothing publishes a rate for a currency only you use, so this one is yours to keep current."
      >
        <div className="flex items-center gap-[10px]">
          <Input
            id="cc-rate"
            value={rate}
            placeholder="0.05"
            aria-invalid={!!shown(rateError)}
            {...numericInputProps({}, setRate)}
            className="min-w-0 flex-1 text-end tabular-nums"
          />
          <span className="shrink-0 text-[13.5px] font-bold text-fp-text-3">
            {base}
          </span>
        </div>
      </FormRow>

      {error ? (
        <p role="alert" className="text-[12.5px] font-semibold text-fp-danger">
          {error}
        </p>
      ) : null}
    </ResponsiveDialog>
  )
}
