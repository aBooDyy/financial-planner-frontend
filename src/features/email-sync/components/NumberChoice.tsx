import type { FieldPick } from '#/features/email-sync/api/types'
import { numberTokens } from '#/lib/lineTokens'
import { cn } from '#/lib/utils'

type Props = {
  line: string
  pick: FieldPick
  onChoose: (pick: FieldPick) => void
}

const CHIP =
  'rounded-full border-[1.5px] px-3 py-1.5 text-[13px] text-fp-text transition'
const ON =
  'border-fp-accent bg-[color-mix(in_srgb,var(--fp-accent)_12%,var(--fp-surface))] font-extrabold'
const OFF =
  'border-fp-border bg-fp-surface font-semibold hover:border-fp-border-strong'

/**
 * The amount's line holds several numbers — a card's last digits, a balance, a date. Which is
 * the amount? Left unsaid, the one written next to the currency is used.
 */
export function NumberChoice({ line, pick, onChoose }: Props) {
  const tokens = numberTokens(line)
  if (tokens.length < 2) return null
  const auto = pick.start === undefined

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span
        id="amount-number-label"
        className="text-[13px] leading-snug font-bold text-fp-text-2"
      >
        That line has {tokens.length} numbers. Which is the amount?
      </span>
      <div
        role="radiogroup"
        aria-labelledby="amount-number-label"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          role="radio"
          aria-checked={auto}
          onClick={() => onChoose({ line: pick.line })}
          className={cn(CHIP, auto ? ON : OFF)}
        >
          The one next to the currency
        </button>
        {tokens.map((token) => {
          const on = pick.start === token.start && pick.end === token.end
          return (
            <button
              key={token.start}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() =>
                onChoose({
                  line: pick.line,
                  start: token.start,
                  end: token.end,
                })
              }
              className={cn(CHIP, 'font-mono tabular-nums', on ? ON : OFF)}
            >
              <bdi dir="ltr">{token.text}</bdi>
            </button>
          )
        })}
      </div>
    </div>
  )
}
