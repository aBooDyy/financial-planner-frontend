type Props = {
  done: number
  total: number
}

const CARD =
  'flex flex-col items-center gap-3 rounded-2xl border border-fp-border bg-fp-surface px-5 py-10 text-center shadow-fp'

/** The one pass over the file, while it runs. Nothing is written by it and nothing is kept. */
export function ScanProgress({ done, total }: Props) {
  const number = new Intl.NumberFormat()
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0

  return (
    <section className={CARD}>
      <div className="flex w-full max-w-[320px] flex-col gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-fp-surface-2">
          <div
            className="h-full rounded-full bg-fp-accent transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p
          aria-live="polite"
          className="text-[13px] font-semibold text-fp-text-2"
        >
          Checking {number.format(done)} of {number.format(total)} rows…
        </p>
      </div>
      <p className="max-w-[420px] text-[12.5px] text-fp-text-3">
        Working out what is ready, what needs a look and what you already have.
      </p>
    </section>
  )
}
