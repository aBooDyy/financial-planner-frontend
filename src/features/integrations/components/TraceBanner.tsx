import { CheckCircle2, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DryRunState } from '#/features/integrations/hooks/useDryRun'
import { OUTCOME_TEXT } from '#/features/integrations/data/verdicts'

type Props = {
  dryRun: DryRunState
  /** The open rule's place in the set. */
  index: number
  ruleNames: string[]
  hasSample: boolean
}

/**
 * Whether this rule is the one that handles the sample, and if not, why: its own condition, or
 * an earlier rule that matches first. Order is the semantics, so this says which rule to move.
 */
export function TraceBanner({ dryRun, index, ruleNames, hasSample }: Props) {
  if (!hasSample) return null
  const { result, error, pending } = dryRun

  let tone: 'ok' | 'info' | 'error' = 'info'
  let body: ReactNode
  if (error) {
    tone = 'error'
    body = error
  } else if (!result?.focus) {
    body = pending ? 'Testing against the sample…' : null
  } else if (result.matchedIndex === index) {
    tone = 'ok'
    body = `This rule handles the sample. ${OUTCOME_TEXT[result.would]}`
  } else if (!result.focus.matched) {
    body = (
      <>
        This rule’s condition doesn’t match the sample
        {result.focus.detail ? (
          <>
            {' '}
            (
            <bdi dir="ltr" className="font-mono text-[12px]">
              {result.focus.detail}
            </bdi>
            )
          </>
        ) : null}
        . The fields show what it would read if it did.
      </>
    )
  } else if (result.matchedIndex !== null) {
    const first = result.matchedIndex
    body = `Rule ${first + 1}, “${ruleNames[first] ?? ''}”, matches the sample first, so this rule won’t run for it. Move this rule above it to change that.`
  }
  if (!body) return null

  const Icon =
    tone === 'ok'
      ? CheckCircle2
      : tone === 'error'
        ? TriangleAlert
        : pending && !result
          ? LoaderCircle
          : Info
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] ${
        tone === 'ok'
          ? 'border-fp-accent/40 bg-fp-accent-soft text-fp-accent-ink'
          : tone === 'error'
            ? 'border-fp-danger/40 text-fp-danger'
            : 'border-fp-border bg-fp-surface-2 text-fp-text-2'
      }`}
    >
      <Icon aria-hidden size={15} strokeWidth={2} className="mt-px shrink-0" />
      <span>{body}</span>
    </p>
  )
}
