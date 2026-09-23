import { AlertTriangle, Info } from 'lucide-react'
import type { ValueNotice } from '#/features/import/hooks/useValueMapping'

type Props = { notice: ValueNotice }

/** A kind the file carries no column for — what every row becomes, and where to change it. */
export function ValueMissingCard({ notice }: Props) {
  const headingId = `value-missing-${notice.kind}`
  const Icon = notice.unresolved ? AlertTriangle : Info

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-fp-border bg-fp-surface-2 px-[14px] py-2.5">
        <h3 id={headingId} className="text-[13.5px] font-bold">
          {notice.title}
        </h3>
        <p className="text-[12px] text-fp-text-2">no column mapped</p>
      </div>

      <p className="flex items-start gap-2 px-[14px] py-3 text-[13px] text-fp-text-2">
        <Icon
          size={14}
          strokeWidth={2}
          aria-hidden
          className={`mt-[3px] shrink-0 ${
            notice.unresolved ? 'text-fp-danger' : 'text-fp-text-3'
          }`}
        />
        {notice.body}
      </p>
    </section>
  )
}
