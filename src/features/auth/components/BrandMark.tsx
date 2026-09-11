type Props = { tone?: 'onLight' | 'onDark' }

/** The Means wordmark: a rounded tile holding a rotated square, beside the name. */
export function BrandMark({ tone = 'onLight' }: Props) {
  const tile =
    tone === 'onDark'
      ? 'bg-white/15 backdrop-blur-sm'
      : 'bg-fp-accent shadow-[0_4px_12px_-4px_var(--fp-accent)]'
  const text = tone === 'onDark' ? 'text-white' : 'text-fp-text'

  return (
    <div className="flex items-center gap-[11px]">
      <div
        className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${tile}`}
      >
        <div className="h-[13px] w-[13px] rotate-45 rounded-[4px] bg-white" />
      </div>
      <span className={`text-[18px] font-extrabold tracking-[-0.02em] ${text}`}>
        Means
      </span>
    </div>
  )
}
