import type { Effect, EffectTone } from '#/features/planned/data/confirmCopy'

const TONE: Record<EffectTone, string> = {
  neutral: 'border-fp-border bg-fp-surface-2 text-fp-text-2',
  good: 'border-transparent bg-fp-accent-soft text-fp-accent-ink',
  partial: 'border-fp-warn/25 bg-fp-warn/10 text-fp-warn',
}

/** The confirm dialog's live "what this does" line. */
export function EffectLine({ effect }: { effect: Effect }) {
  return (
    <p
      aria-live="polite"
      data-tone={effect.tone}
      className={`rounded-[11px] border px-3 py-[10px] text-[12.5px] leading-[1.45] ${TONE[effect.tone]}`}
    >
      {effect.text}
    </p>
  )
}
