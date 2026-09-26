import { CheckCircle2, Info, LoaderCircle, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DryRunState } from '#/features/integrations/hooks/useDryRun'
import { NoteBox } from '#/components/dialog/NoteBox'
import type { NoteTone } from '#/components/dialog/NoteBox'
import { OUTCOME_TEXT } from '#/features/integrations/data/verdicts'

const NOTE_TONE: Record<'ok' | 'info' | 'error', NoteTone> = {
  ok: 'accent',
  info: 'neutral',
  error: 'danger',
}

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
    <NoteBox tone={NOTE_TONE[tone]} icon={<Icon />}>
      <span role="status">{body}</span>
    </NoteBox>
  )
}
