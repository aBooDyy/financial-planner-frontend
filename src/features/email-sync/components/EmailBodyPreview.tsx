type Props = {
  lines: string[]
  truncated: boolean
  loading: boolean
  error: string | null
  /** When given, each line becomes tappable so its values can fill the form. */
  onUseLine?: (line: string) => void
}

const SHELL =
  'overflow-hidden rounded-[12px] border border-fp-border bg-fp-surface-2'
const MESSAGE = 'px-[13px] py-[14px] text-[12.5px] text-fp-text-3'

/** The email an import was parsed from, as it was stored at sync time. */
export function EmailBodyPreview({
  lines,
  truncated,
  loading,
  error,
  onUseLine,
}: Props) {
  if (loading)
    return (
      <div className={SHELL}>
        <div className={MESSAGE}>Loading the email…</div>
      </div>
    )
  if (error)
    return (
      <div className={SHELL}>
        <div className={`${MESSAGE} font-semibold text-fp-danger`}>{error}</div>
      </div>
    )
  if (lines.length === 0)
    return (
      <div className={SHELL}>
        <div className={MESSAGE}>
          This alert was logged before emails were kept, so its content isn't
          stored.
        </div>
      </div>
    )

  return (
    <div className={SHELL}>
      {onUseLine ? (
        <div className="border-b border-fp-border px-[13px] py-[7px] text-[11.5px] font-semibold text-fp-text-3">
          Tap a line to use its amount
        </div>
      ) : null}
      <div className="max-h-[220px] overflow-auto p-[8px]">
        {lines.map((line, i) => {
          const className =
            'mb-px block w-full rounded-[8px] px-[10px] py-[7px] text-start font-mono text-[12.5px] leading-[1.45] text-fp-text whitespace-pre-wrap'
          return onUseLine ? (
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
          )
        })}
      </div>
      {truncated ? (
        <div className="border-t border-fp-border px-[13px] py-[7px] text-[11.5px] text-fp-text-3">
          Long email — only the first part was kept.
        </div>
      ) : null}
    </div>
  )
}
