type Props = {
  done: number
  total: number
}

const CARD =
  'flex flex-col items-center gap-3 rounded-2xl border border-fp-border bg-fp-surface px-5 py-10 text-center shadow-fp'

/** The commit as it happens: real counts, because they are known. */
export function CommitProgress({ done, total }: Props) {
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
          Importing {number.format(done)} of {number.format(total)}…
        </p>
      </div>
      <p className="max-w-[420px] text-[12.5px] text-fp-text-3">
        This cannot be stopped once it has started. If it turns out wrong, you
        can undo the whole import afterwards.
      </p>
    </section>
  )
}
