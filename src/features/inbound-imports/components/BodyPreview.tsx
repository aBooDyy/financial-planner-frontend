import { useMemo } from 'react'
import type { ReactNode } from 'react'
import type { BodyFormat } from '#/features/inbound-imports/api/types'
import { bodyNoun } from '#/features/inbound-imports/data/sources'
import { usePayloadView } from './payloadView'

type Props = {
  format: BodyFormat
  lines: string[]
  truncated: boolean
  loading: boolean
  error: string | null
}

const SHELL =
  'flex min-w-0 flex-col gap-2 rounded-[16px] border-[1.5px] border-fp-border bg-fp-surface p-3'
const MESSAGE = 'text-[12.5px] text-fp-text-3'
const MONO =
  'font-mono text-[12.5px] leading-[1.5] whitespace-pre-wrap text-fp-text'
const FOOTNOTE = 'text-[11.5px] text-fp-text-3'

function Shell({ children }: { children: ReactNode }) {
  return <div className={SHELL}>{children}</div>
}

function Notice({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <p className={danger ? `${MESSAGE} font-semibold text-fp-danger` : MESSAGE}>
      {children}
    </p>
  )
}

function TextLines({ lines }: { lines: string[] }) {
  return (
    <div className="-mx-[6px] flex max-h-[220px] flex-col gap-[2px] overflow-auto">
      {lines.map((line, i) => (
        <div key={i} className={`px-[10px] py-[7px] ${MONO}`}>
          {line}
        </div>
      ))}
    </div>
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
}: {
  lines: string[]
  truncated: boolean
}) {
  const View = usePayloadView()
  const payload = useMemo(
    () => readPayload(lines, truncated),
    [lines, truncated],
  )

  if (payload && View) return <View payload={payload} />

  return (
    <Shell>
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
}: Props) {
  const noun = bodyNoun(format)
  if (loading || error || lines.length === 0)
    return (
      <Shell>
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

  if (format === 'json') return <JsonBody lines={lines} truncated={truncated} />

  return (
    <Shell>
      <TextLines lines={lines} />
      {truncated ? (
        <p className={FOOTNOTE}>Long email — only the first part was kept.</p>
      ) : null}
    </Shell>
  )
}
