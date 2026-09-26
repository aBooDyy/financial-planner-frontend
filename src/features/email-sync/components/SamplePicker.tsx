import { useState } from 'react'
import { Loader2, MailX } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { NoteBox } from '#/components/dialog/NoteBox'
import { Input } from '#/components/ui/input'
import type { SampleGroup } from '#/features/email-sync/data/samples'
import type { InboxSamples } from '#/features/email-sync/hooks/useInboxSamples'
import { SampleGroupCard } from './SampleGroupCard'
import { SmallButton } from './SmallButton'

type Props = {
  inbox: InboxSamples
  /** In the order to show them — the rule's own senders first. */
  groups: SampleGroup[]
  selectedGroupId: string | null
  onPick: (group: SampleGroup) => void
}

const LIKELY_FIRST = 8

/**
 * The inbox's recent mail, one card per template: identical and near-identical alerts fold
 * into one, so a template is mapped once and checked on the rest.
 */
export function SamplePicker({
  inbox,
  groups,
  selectedGroupId,
  onPick,
}: Props) {
  const [showAll, setShowAll] = useState(false)
  const [sender, setSender] = useState('')

  if (inbox.status === 'loading' || inbox.status === 'idle') {
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-fp-text-3">
        <Loader2 size={14} strokeWidth={2} className="animate-spin" />
        Reading your latest emails…
      </p>
    )
  }
  if (inbox.status === 'failed') {
    return (
      <NoteBox tone="danger">
        <div className="flex flex-wrap items-center gap-3">
          <span role="alert" className="flex-1">
            {inbox.error ?? 'Couldn’t read your inbox.'}
          </span>
          <SmallButton type="button" onClick={inbox.reload}>
            Try again
          </SmallButton>
        </div>
      </NoteBox>
    )
  }

  const shown = showAll ? groups : groups.slice(0, LIKELY_FIRST)
  const loadMore = () => {
    const address = sender.trim()
    if (address) void inbox.loadMoreFrom(address)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] leading-[1.5] text-fp-text-2">
        Pick one alert from your bank or card. Emails that look alike are
        grouped, so you only point things out once.
      </p>
      {groups.length === 0 ? (
        <EmptyState
          icon={MailX}
          size="sm"
          framed
          title="No recent emails found"
          text="Nothing arrived in this inbox recently to learn from."
        />
      ) : (
        <div className="overflow-hidden rounded-[14px] border-[1.5px] border-fp-border">
          <div className="max-h-[360px] overflow-auto">
            {shown.map((group) => (
              <SampleGroupCard
                key={group.id}
                group={group}
                selected={group.id === selectedGroupId}
                onPick={() => onPick(group)}
              />
            ))}
          </div>
        </div>
      )}
      {!showAll && groups.length > LIKELY_FIRST ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="self-start text-[13px] font-bold text-fp-accent-ink hover:underline"
        >
          Show all {groups.length} kinds of email
        </button>
      ) : null}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          loadMore()
        }}
      >
        <label htmlFor="sample-sender" className="sr-only">
          Find more emails from a sender
        </label>
        <Input
          id="sample-sender"
          dir="ltr"
          type="email"
          inputMode="email"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          placeholder="alerts@yourbank.com"
          className="min-w-0 flex-1 py-[9px] text-[13px]"
        />
        <SmallButton
          type="submit"
          disabled={!sender.trim() || inbox.loadingSender !== null}
        >
          {inbox.loadingSender ? 'Looking…' : 'Find their emails'}
        </SmallButton>
      </form>
    </div>
  )
}
