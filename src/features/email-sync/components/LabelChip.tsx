import { AlertTriangle, Tag } from 'lucide-react'
import type {
  ExtractField,
  LearnedLabel,
} from '#/features/email-sync/api/types'
import { foundLabel, keywordsText } from '#/features/email-sync/data/labels'
import { cn } from '#/lib/utils'

type Props = {
  field: ExtractField
  label: LearnedLabel
}

/** How the learned rule finds one field: by a label and where it sits, or by keywords. */
export function LabelChip({ field, label }: Props) {
  const found = foundLabel(label)
  const Icon = label.verified ? Tag : AlertTriangle

  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] leading-snug font-semibold',
        label.verified
          ? 'bg-fp-surface-2 text-fp-text-2'
          : 'bg-fp-warn/10 text-fp-warn',
      )}
    >
      <Icon aria-hidden size={12} strokeWidth={2.2} className="shrink-0" />
      <span className="min-w-0 truncate">
        {found ? (
          <>
            Found by “<bdi className="font-bold">{found.text}</bdi>” ·{' '}
            {found.position}
          </>
        ) : (
          keywordsText(field)
        )}
      </span>
    </span>
  )
}
