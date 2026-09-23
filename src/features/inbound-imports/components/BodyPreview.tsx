import { useMemo } from 'react'
import type { BodyFormat } from '#/features/inbound-imports/api/types'
import type {
  PayloadPick,
  PickField,
} from '#/features/inbound-imports/data/pickValues'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import { PickTargetBar } from './PickTargetBar'
import { usePayloadView } from './payloadView'

type PayloadPicking = {
  target: PickField
  onTarget: (field: PickField) => void
  onPick: (pick: PayloadPick) => void
}

type Props = {
  format: BodyFormat
  lines: string[]
  truncated: boolean
  loading: boolean
  error: string | null
  /** When given, each text line becomes tappable so its values can fill the form. */
  onUseLine?: (line: string) => void
  /** When given, a JSON body's values become tappable into the chosen form field. */
  picking?: PayloadPicking
}

const SHELL =
  'overflow-hidden rounded-[12px] border border-fp-border bg-fp-surface-2'
const MESSAGE = 'px-[13px] py-[14px] text-[12.5px] text-fp-text-3'
const MONO =
  'font-mono text-[12.5px] leading-[1.45] text-fp-text whitespace-pre-wrap'
const FOOTNOTE =
  'border-t border-fp-border px-[13px] py-[7px] text-[11.5px] text-fp-text-3'

function Notice({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <div className={SHELL}>
      <div
        className={danger ? `${MESSAGE} font-semibold text-fp-danger` : MESSAGE}
      >
        {children}
      </div>
    </div>
  )
}

function TextLines({
  lines,
  onUseLine,
}: {
  lines: string[]
  onUseLine?: (line: string) => void
}) {
  const className = `mb-px block w-full rounded-[8px] px-[10px] py-[7px] text-start ${MONO}`
  return (
    <>
      {onUseLine ? (
        <div className="border-b border-fp-border px-[13px] py-[7px] text-[11.5px] font-semibold text-fp-text-3">
          Tap a line to use its amount
        </div>
      ) : null}
      <div className="max-h-[220px] overflow-auto p-[8px]">
        {lines.map((line, i) =>
          onUseLine ? (
            <button
              key={i}
              type="button"
              onClick={() => onUseLine(line)}
              className={`${className} hover:bg-fp-accent-soft`}
            >
              {line}
            </button>
          ) : (
            <div key={i} className={className}>
              {line}
            </div>
          ),
        )}
      </div>
    </>
  )
}

/** The payload as an object, or null when it is not one — a cut-off body never is. */
function readPayload(
  lines: string[],
  truncated: boolean,
): Record<string, unknown> | null {
  if (truncated || lines.length === 0) return null
  try {
    const value: unknown = JSON.parse(lines.join('\n'))
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function RawJson({ text }: { text: string }) {
  return (
    <pre
      dir="ltr"
      className={`max-h-[220px] overflow-auto px-[13px] py-[10px] text-start break-all ${MONO}`}
    >
      {text}
    </pre>
  )
}

function JsonBody({
  lines,
  truncated,
  picking,
}: {
  lines: string[]
  truncated: boolean
  picking?: PayloadPicking
}) {
  const View = usePayloadView()
  const payload = useMemo(
    () => readPayload(lines, truncated),
    [lines, truncated],
  )

  if (payload && View) {
    return (
      <div className="flex flex-col gap-2">
        {picking ? (
          <PickTargetBar target={picking.target} onTarget={picking.onTarget} />
        ) : null}
        <View
          payload={payload}
          target={picking?.target ?? null}
          onPick={picking?.onPick}
        />
      </div>
    )
  }

  return (
    <div className={SHELL}>
      <RawJson
        text={payload ? JSON.stringify(payload, null, 2) : lines.join('\n')}
      />
      {truncated ? (
        <div className={FOOTNOTE}>
          Long payload — only the first part was kept, so it is shown as text.
        </div>
      ) : null}
    </div>
  )
}

/** The body an import was parsed from, as it was stored when it was staged. */
export function BodyPreview({
  format,
  lines,
  truncated,
  loading,
  error,
  onUseLine,
  picking,
}: Props) {
  const noun = bodyNoun(format)
  if (loading) return <Notice>{`Loading the ${noun}…`}</Notice>
  if (error) return <Notice danger>{error}</Notice>
  if (lines.length === 0)
    return (
      <Notice>
        {`This import was logged before ${noun}s were kept, so its content isn't stored.`}
      </Notice>
    )

  if (format === 'json') {
    return <JsonBody lines={lines} truncated={truncated} picking={picking} />
  }

  return (
    <div className={SHELL}>
      <TextLines lines={lines} onUseLine={onUseLine} />
      {truncated ? (
        <div className={FOOTNOTE}>
          Long email — only the first part was kept.
        </div>
      ) : null}
    </div>
  )
}
