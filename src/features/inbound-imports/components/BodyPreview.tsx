import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'
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
  /** Under the body, inside its card (e.g. "Fix the rule"). */
  footer?: ReactNode
}

const SHELL =
  'flex min-w-0 flex-col gap-2 rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface p-3'
const MESSAGE = 'text-[12.5px] text-fp-text-3'
const MONO =
  'font-mono text-[12.5px] leading-[1.5] whitespace-pre-wrap text-fp-text'
const FOOTNOTE = 'text-[11.5px] text-fp-text-3'

function Shell({
  children,
  footer,
}: {
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className={SHELL}>
      {children}
      {footer}
    </div>
  )
}

function Notice({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <p className={danger ? `${MESSAGE} font-semibold text-fp-danger` : MESSAGE}>
      {children}
    </p>
  )
}

function TextLines({
  lines,
  onUseLine,
}: {
  lines: string[]
  onUseLine?: (line: string) => void
}) {
  const [used, setUsed] = useState<number | null>(null)
  const className = `block w-full rounded-[9px] border-[1.5px] border-transparent px-[10px] py-[7px] text-start ${MONO}`
  return (
    <>
      {onUseLine ? (
        <div className="text-[12px] font-bold text-fp-text-2">
          Tap a line to use its amount
        </div>
      ) : null}
      <div className="-mx-[6px] flex max-h-[220px] flex-col gap-[2px] overflow-auto">
        {lines.map((line, i) =>
          onUseLine ? (
            <button
              key={i}
              type="button"
              onClick={() => {
                setUsed(i)
                onUseLine(line)
              }}
              className={cn(
                className,
                used === i
                  ? 'border-dashed border-fp-accent'
                  : 'text-fp-text-2 hover:bg-fp-accent-soft',
              )}
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
      className={`max-h-[220px] overflow-auto text-start break-all ${MONO}`}
    >
      {text}
    </pre>
  )
}

function JsonBody({
  lines,
  truncated,
  picking,
  footer,
}: {
  lines: string[]
  truncated: boolean
  picking?: PayloadPicking
  footer?: ReactNode
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
        {footer}
      </div>
    )
  }

  return (
    <Shell footer={footer}>
      <RawJson
        text={payload ? JSON.stringify(payload, null, 2) : lines.join('\n')}
      />
      {truncated ? (
        <p className={FOOTNOTE}>
          Long payload — only the first part was kept, so it is shown as text.
        </p>
      ) : null}
    </Shell>
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
  footer,
}: Props) {
  const noun = bodyNoun(format)
  if (loading || error || lines.length === 0)
    return (
      <Shell footer={footer}>
        {loading ? (
          <Notice>{`Loading the ${noun}…`}</Notice>
        ) : error ? (
          <Notice danger>{error}</Notice>
        ) : (
          <Notice>
            {`This import was logged before ${noun}s were kept, so its content isn't stored.`}
          </Notice>
        )}
      </Shell>
    )

  if (format === 'json') {
    return (
      <JsonBody
        lines={lines}
        truncated={truncated}
        picking={picking}
        footer={footer}
      />
    )
  }

  return (
    <Shell footer={footer}>
      <TextLines lines={lines} onUseLine={onUseLine} />
      {truncated ? (
        <p className={FOOTNOTE}>Long email — only the first part was kept.</p>
      ) : null}
    </Shell>
  )
}
