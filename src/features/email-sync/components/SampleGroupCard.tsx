import { Layers } from 'lucide-react'
import type { SampleGroup } from '#/features/email-sync/data/samples'
import { cn } from '#/lib/utils'

type Props = {
  group: SampleGroup
  selected: boolean
  onPick: () => void
}

/** One template's worth of emails: its newest member, and how many look just like it. */
export function SampleGroupCard({ group, selected, onPick }: Props) {
  const { representative: message } = group
  const similar = group.members.length - 1
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      className={cn(
        'flex w-full flex-col gap-0.5 border-b border-fp-border px-[14px] py-3 text-start last:border-b-0 hover:bg-fp-surface-2',
        selected &&
          'bg-[color-mix(in_srgb,var(--fp-accent)_6%,var(--fp-surface))] hover:bg-[color-mix(in_srgb,var(--fp-accent)_6%,var(--fp-surface))]',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[13.5px] font-extrabold">
          <bdi>{group.senderName ?? group.senderEmail}</bdi>
        </span>
        {group.likely ? (
          <span className="shrink-0 rounded-full bg-fp-accent-soft px-2 py-0.5 text-[11px] font-extrabold tracking-[0.02em] whitespace-nowrap text-fp-accent-ink">
            Likely alert
          </span>
        ) : null}
        <span className="ms-auto shrink-0 text-[11.5px] text-fp-text-3">
          {message.date ?? ''}
        </span>
      </span>
      <span className="block truncate text-[13px] font-medium text-fp-text">
        <bdi>{message.subject || '(no subject)'}</bdi>
      </span>
      <span className="flex items-center gap-2 text-[12px] text-fp-text-3">
        <span className="min-w-0 flex-1 truncate">
          <bdi>{message.preview}</bdi>
        </span>
        {similar > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-fp-text-2">
            <Layers size={12} strokeWidth={2} />
            {similar} similar
          </span>
        ) : null}
      </span>
    </button>
  )
}
