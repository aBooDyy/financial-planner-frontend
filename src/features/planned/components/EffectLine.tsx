import { Check } from 'lucide-react'
import { NoteBox } from '#/components/dialog/NoteBox'
import type { NoteTone } from '#/components/dialog/NoteBox'
import type { Effect, EffectTone } from '#/features/planned/data/confirmCopy'

const TONE: Record<EffectTone, NoteTone> = {
  neutral: 'neutral',
  good: 'accent',
  partial: 'warn',
}

const PARTIAL = 'Partial:'

/** The confirm dialog's live "what this does" line. */
export function EffectLine({ effect }: { effect: Effect }) {
  const lead = effect.text.startsWith(PARTIAL) ? PARTIAL : null
  return (
    <div aria-live="polite" data-tone={effect.tone}>
      <NoteBox
        tone={TONE[effect.tone]}
        icon={effect.tone === 'good' ? <Check strokeWidth={2.4} /> : undefined}
      >
        {lead ? (
          <>
            <b className="font-extrabold">{lead}</b>
            {effect.text.slice(lead.length)}
          </>
        ) : (
          effect.text
        )}
      </NoteBox>
    </div>
  )
}
