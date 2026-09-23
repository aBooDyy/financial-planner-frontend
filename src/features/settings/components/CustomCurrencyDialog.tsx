import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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

/** The exponents ISO-4217 itself uses; anything else can't round-trip through minor units. */
const MINOR_UNITS = [
  { value: 0, label: 'None — whole units (like JPY)' },
  { value: 2, label: 'Two (like USD)' },
  { value: 3, label: 'Three (like KWD)' },
]

const FIELD =
  'rounded-[11px] border-fp-border-strong px-3 py-[11px] text-[14px] focus:shadow-[0_0_0_3px_var(--fp-accent-soft)]'

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
  const [error, setError] = useState<string | null>(null)

  const upper = code.trim().toUpperCase()
  const perBase = Number(rate.replace(/[\s,]/g, ''))
  const codeError =
    editing || upper === ''
      ? null
      : !CODE_PATTERN.test(upper)
        ? 'Use exactly three letters.'
        : isSupportedCurrency(upper)
          ? `${upper} is a standard currency already.`
          : takenCodes.includes(upper)
            ? `You already have a currency called ${upper}.`
            : null

  const valid =
    (editing || (CODE_PATTERN.test(upper) && codeError === null)) &&
    name.trim() !== '' &&
    symbol.trim() !== '' &&
    Number.isFinite(perBase) &&
    perBase > 0

  const submit = () => {
    if (!valid || busy) return
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
      footer={
        <>
          <div className="flex-1" />
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!valid || busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add currency'}
          </Button>
        </>
      }
      contentClassName="sm:max-w-[430px]"
    >
      <div className="flex flex-col gap-[13px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cc-code">Code</Label>
          <Input
            id="cc-code"
            value={editing ? initial.code : code}
            disabled={editing}
            maxLength={3}
            autoCapitalize="characters"
            placeholder="PTS"
            onChange={(e) => setCode(e.target.value)}
            className={`${FIELD} uppercase`}
          />
          <p className="text-[12px] text-fp-text-3">
            {editing
              ? 'The code is fixed — money is already stored against it.'
              : (codeError ??
                'Three letters, and not one ISO-4217 already uses.')}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cc-name">Name</Label>
          <Input
            id="cc-name"
            value={name}
            placeholder="Airline points"
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cc-symbol">Symbol</Label>
          <Input
            id="cc-symbol"
            value={symbol}
            maxLength={8}
            placeholder="pts"
            onChange={(e) => setSymbol(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Decimal places</Label>
          <Select
            value={String(minorUnit)}
            onValueChange={(v) => setMinorUnit(Number(v))}
            disabled={editing}
          >
            <SelectTrigger aria-label="Decimal places">
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
          {editing ? (
            <p className="text-[12px] text-fp-text-3">
              Fixed — every amount held in {initial.code} is already scaled by
              it.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cc-rate">Rate</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[13.5px] text-fp-text-2">
              1 {upper || 'unit'} =
            </span>
            <Input
              id="cc-rate"
              value={rate}
              inputMode="decimal"
              placeholder="0.05"
              onChange={(e) => setRate(e.target.value)}
              className={`${FIELD} w-[120px] text-end tabular-nums`}
            />
            <span className="shrink-0 text-[13.5px] font-semibold text-fp-text-3">
              {base}
            </span>
          </div>
          <p className="text-[12px] text-fp-text-3">
            Nothing publishes a rate for a currency only you use, so this one is
            yours to keep current.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-[12.5px] text-fp-danger">
            {error}
          </p>
        ) : null}
      </div>
    </ResponsiveDialog>
  )
}
