import type { ContributionMark as Mark } from '#/features/goals/data/goalDetail'

type Props = {
  mark: Mark
  color: string
  size?: number
}

/** Solid in the goal's colour = confirmed; hollow amber = needs confirming; hollow grey = planned. */
export function ContributionMark({ mark, color, size = 10 }: Props) {
  const style =
    mark === 'confirmed'
      ? { background: color }
      : {
          border: `2px solid ${mark === 'due' ? 'var(--fp-warn)' : 'var(--fp-border-strong)'}`,
          background: 'var(--fp-surface)',
        }
  return (
    <span
      aria-hidden
      data-mark={mark}
      className="block flex-none rounded-full"
      style={{ width: size, height: size, ...style }}
    />
  )
}
