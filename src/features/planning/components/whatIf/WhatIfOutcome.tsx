import type { WhatIfResult } from '#/features/planning/data/whatIf'
import type { PayCalendar } from '#/features/planning/data/payPeriods'
import { signedMoney } from '#/features/planning/view/format'
import {
  comparePaycheck,
  knockOnLine,
  whatIfHeadline,
} from '#/features/planning/view/whatIf'
import type { WhatIfHeadline } from '#/features/planning/view/whatIf'
import type { CurrencyCode } from '#/lib/currency'
import { cn } from '#/lib/utils'
import { MicroLabel } from '#/features/planning/components/kit/MicroLabel'

const TONE: Record<WhatIfHeadline['tone'], string> = {
  ok: 'bg-fp-accent-soft text-fp-accent-ink',
  warn: 'bg-fp-warn-soft text-fp-warn',
  danger: 'bg-fp-danger-soft text-fp-danger',
  neutral: 'bg-fp-surface-2 text-fp-text',
}

type Props = {
  result: WhatIfResult
  base: CurrencyCode
  calendar: PayCalendar
}

/** The answer: whether it fits, the paycheck now and with it, and what else would change. */
export function WhatIfOutcome({ result, base, calendar }: Props) {
  const headline = whatIfHeadline(result, base, calendar)
  const compare = comparePaycheck(
    result.before.paycheck,
    result.after.paycheck,
    base,
    calendar,
  )
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className={cn('rounded-[14px] px-4 py-3', TONE[headline.tone])}>
        <p className="fp-sensitive text-[15px] font-extrabold">
          {headline.title}
        </p>
        {headline.sub ? (
          <p className="fp-sensitive mt-[2px] text-[12.5px] leading-[1.45] text-fp-text-2">
            {headline.sub}
          </p>
        ) : null}
      </div>

      {compare.rows.length > 0 ? (
        <div>
          <MicroLabel className="mb-2">Each paycheck</MicroLabel>
          <div className="relative flex flex-col gap-[6px]">
            {compare.bars.map((bar) => (
              <div key={bar.label} className="flex items-center gap-2">
                <span className="w-[60px] flex-none text-[11.5px] font-bold text-fp-text-3">
                  {bar.label}
                </span>
                <div className="relative flex h-[18px] min-w-0 flex-1 gap-[2px] overflow-hidden rounded-[6px] bg-fp-surface-2">
                  {bar.segments.map((s) => (
                    <span
                      key={s.key}
                      className="h-full min-w-[2px]"
                      style={{ width: `${s.pct}%`, background: s.color }}
                    />
                  ))}
                  {compare.payAt !== null ? (
                    <span
                      aria-hidden
                      title="Your pay"
                      className="absolute inset-y-0 w-[2px] bg-fp-danger"
                      style={{ insetInlineStart: `${compare.payAt}%` }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <table className="mt-2 w-full text-[12.5px]">
            <thead>
              <tr className="text-[11px] font-bold text-fp-text-3">
                <th scope="col" className="py-1 text-start font-bold">
                  <span className="sr-only">Part of your pay</span>
                </th>
                <th scope="col" className="py-1 text-end font-bold">
                  Now
                </th>
                <th scope="col" className="py-1 ps-3 text-end font-bold">
                  With this
                </th>
              </tr>
            </thead>
            <tbody>
              {compare.rows.map((r) => (
                <tr key={r.key} className="border-t border-fp-border">
                  <th
                    scope="row"
                    className="py-[6px] text-start font-semibold text-fp-text-2"
                  >
                    <span
                      aria-hidden
                      className="me-2 inline-block size-[9px] rounded-[3px]"
                      style={{ background: r.color }}
                    />
                    {r.label}
                  </th>
                  <td className="fp-sensitive py-[6px] text-end text-fp-text-3 tabular-nums">
                    {signedMoney(r.now, base)}
                  </td>
                  <td
                    className={cn(
                      'fp-sensitive py-[6px] ps-3 text-end font-extrabold tabular-nums',
                      r.then < 0 && 'text-fp-danger',
                    )}
                  >
                    {signedMoney(r.then, base)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result.knockOns.length > 0 ? (
        <div>
          <MicroLabel className="mb-1">What else would change</MicroLabel>
          <ul className="flex list-disc flex-col gap-1 ps-4 text-[12.5px] leading-[1.45] text-fp-text-2">
            {result.knockOns.map((k) => (
              <li key={`${k.kind}:${k.id}`} className="fp-sensitive">
                {knockOnLine(k, calendar)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
