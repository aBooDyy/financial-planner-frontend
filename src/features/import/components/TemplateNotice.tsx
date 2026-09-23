import { AlertTriangle } from 'lucide-react'
import type { UnknownAlias } from '#/features/import/data/templates'

type Props = { unknown: ReadonlyArray<UnknownAlias> }

/**
 * What a restored mapping could not restore. Shown the moment the template is applied —
 * a dropped answer that stayed silent would come back as a row filed somewhere nobody chose.
 */
export function TemplateNotice({ unknown }: Props) {
  if (unknown.length === 0) return null

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl border border-fp-border-strong bg-fp-surface-2 px-3.5 py-2.5 text-[12.5px] text-fp-text"
    >
      <AlertTriangle
        size={15}
        strokeWidth={1.9}
        aria-hidden
        className="mt-[2px] shrink-0 text-fp-danger"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">
          {unknown.length === 1
            ? 'One answer in this template no longer applies.'
            : `${unknown.length} answers in this template no longer apply.`}
        </span>
        <ul className="flex flex-col gap-0.5 text-fp-text-2">
          {unknown.map((item) => (
            <li key={`${item.kind}:${item.key}`}>{item.message}</li>
          ))}
        </ul>
        <span className="text-fp-text-3">
          We’ll ask about them again in the next two steps.
        </span>
      </div>
    </div>
  )
}
