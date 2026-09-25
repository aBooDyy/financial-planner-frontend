import { currencyName, formatMoney, toMinor } from '#/lib/currency'
import type { CurrencyCode } from '#/lib/currency'
import { SelectMark } from './SelectMark'
import { selectableCard } from './selectableCard'

type Props = {
  code: CurrencyCode
  on: boolean
  onPick: () => void
}

const SAMPLE_AMOUNT = 1250

export function CurrencyCard({ code, on, onPick }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={selectableCard(
        on,
        'flex items-center gap-[13px] rounded-[14px] px-[15px] py-[13px]',
      )}
    >
      <span className="flex h-[34px] w-11 flex-none items-center justify-center rounded-[9px] bg-fp-surface-2 text-[12.5px] font-extrabold tracking-[0.02em] text-fp-text-2">
        {code}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-bold">
          {currencyName(code)}
        </span>
        <span className="mt-px block text-[12.5px] text-fp-text-3 tabular-nums">
          {formatMoney(toMinor(SAMPLE_AMOUNT, code), code)}
        </span>
      </span>
      <SelectMark on={on} kind="radio" />
    </button>
  )
}
