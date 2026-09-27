import { CurrencyPicker } from '#/components/CurrencyPicker'
import { PillSwitch } from '#/components/dialog/PillSwitch'
import { FieldLabel } from '#/components/FieldLabel'
import { FieldMessage } from '#/components/FormRow'
import type {
  CurrencyMode,
  DecimalStyle,
  LearnOptions,
} from '#/features/email-sync/api/types'
import { readNumber } from '#/lib/lineTokens'
import type { CurrencyCode } from '#/lib/currency'
import { useDirectionStore } from '#/stores/direction'

const DECIMALS: { value: DecimalStyle; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'dot', label: '1,234.56' },
  { value: 'comma', label: '1.234,56' },
]

const CURRENCY_MODES: { value: CurrencyMode; label: string }[] = [
  { value: 'from_email', label: 'From the email' },
  { value: 'fixed', label: 'Always the same' },
]

type Props = {
  options: LearnOptions
  /** The amount as written in the sample, when one is picked. */
  rawAmount: string | null
  /** The currency the sample was read as, to seed a fixed choice. */
  detectedCurrency: CurrencyCode | null
  baseCurrency: CurrencyCode
  onDecimal: (style: DecimalStyle) => void
  onCurrency: (mode: CurrencyMode, code: CurrencyCode | null) => void
}

/**
 * How the rule reads what it finds: which mark is the decimal point, and whether the currency
 * comes from the email or is always the same. Saying so beats guessing — `1.234` is a thousand
 * in one bank's alerts and one-and-a-bit in another's.
 */
export function ReadingOptions({
  options,
  rawAmount,
  detectedCurrency,
  baseCurrency,
  onDecimal,
  onCurrency,
}: Props) {
  const locale = useDirectionStore((s) => s.locale)
  const read =
    rawAmount === null ? null : readNumber(rawAmount, options.decimal)
  const shown =
    read === null
      ? null
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(read)
  const fixed = options.currency.mode === 'fixed'

  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
      <div className="min-w-0">
        <FieldLabel>How the amount writes decimals</FieldLabel>
        <PillSwitch
          label="How the amount writes decimals"
          value={options.decimal}
          options={DECIMALS}
          onChange={onDecimal}
        />
        {rawAmount !== null ? (
          <p
            className="mt-[7px] text-[12px] leading-[1.45] font-medium text-fp-text-3"
            aria-live="polite"
          >
            “<bdi dir="ltr">{rawAmount}</bdi>”{' '}
            {shown === null ? (
              <span className="text-fp-warn">
                doesn’t read as a number this way
              </span>
            ) : (
              <>
                reads as{' '}
                <bdi className="font-semibold text-fp-text">{shown}</bdi>
              </>
            )}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <FieldLabel>Currency</FieldLabel>
        <PillSwitch
          label="Currency"
          value={options.currency.mode}
          options={CURRENCY_MODES}
          onChange={(mode) =>
            onCurrency(
              mode,
              mode === 'fixed'
                ? (options.currency.code ?? detectedCurrency ?? baseCurrency)
                : null,
            )
          }
        />
        {fixed ? (
          <CurrencyPicker
            value={options.currency.code ?? baseCurrency}
            onChange={(code) => onCurrency('fixed', code)}
            base={baseCurrency}
            label="Currency every email from this rule is in"
            className="mt-2 w-full"
          />
        ) : (
          <FieldMessage help="Tap the line that names the currency — often the amount’s own line." />
        )}
      </div>
    </div>
  )
}
