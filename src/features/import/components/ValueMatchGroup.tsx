import { useCallback } from 'react'
import { ValueMatchRow, VALUE_GRID } from './ValueMatchRow'
import type { ReactNode } from 'react'
import type { ValueGroup, ValueKind } from '#/features/import/data/values'
import type { CurrencyCode } from '#/lib/currency'

type Props = {
  group: ValueGroup
  action?: ReactNode
  createLabel: string | null
  skipLabel: string | null
  baseCurrency: CurrencyCode
  defaultLabel: string | null
  onChange: (kind: ValueKind, key: string, value: string) => void
  onCreate: (kind: ValueKind, key: string, raw: string) => void
}

/** One kind of value from the file — how many there are, and how many we already know. */
export function ValueMatchGroup({
  group,
  action,
  createLabel,
  skipLabel,
  baseCurrency,
  defaultLabel,
  onChange,
  onCreate,
}: Props) {
  const headingId = `value-group-${group.kind}`

  // The rows are memoised, and a callback made per row would be a new prop on every render.
  const kind = group.kind
  const change = useCallback(
    (key: string, value: string) => onChange(kind, key, value),
    [onChange, kind],
  )
  const create = useCallback(
    (key: string, raw: string) => onCreate(kind, key, raw),
    [onCreate, kind],
  )

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-fp-border bg-fp-surface-2 px-[14px] py-2.5">
        <h3 id={headingId} className="text-[13.5px] font-bold">
          {group.title}
        </h3>
        <p
          aria-live="polite"
          className="text-[12px] text-fp-text-2 tabular-nums"
        >
          {group.found} found · {group.matched} matched
        </p>
        {action ? <div className="ms-auto">{action}</div> : null}
      </div>

      <div
        className={`${VALUE_GRID} hidden border-b border-fp-border px-[14px] py-2 text-[11.5px] font-semibold text-fp-text-3 md:grid`}
      >
        <span>In the file</span>
        <span>In Means</span>
        <span className="md:text-end">Match</span>
      </div>

      {group.rows.map((row) => (
        <ValueMatchRow
          key={row.key}
          row={row}
          options={group.options}
          createLabel={createLabel}
          skipLabel={skipLabel}
          baseCurrency={baseCurrency}
          defaultLabel={defaultLabel}
          onChange={change}
          onCreate={create}
        />
      ))}
    </section>
  )
}
