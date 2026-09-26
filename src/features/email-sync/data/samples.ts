import type { EmailSample, InboxMessage } from '#/features/email-sync/api/types'

/** Emails that share a template: define what to read once, check it on the rest. */
export type SampleGroup = {
  id: string
  senderEmail: string
  senderName: string | null
  /** The newest member — the one the user maps. */
  representative: InboxMessage
  members: InboxMessage[]
  likely: boolean
}

export const sampleOf = (m: InboxMessage): EmailSample => ({
  id: m.id,
  senderEmail: m.senderEmail,
  senderName: m.senderName,
  subject: m.subject,
  bodyLines: m.bodyLines,
})

/**
 * Messages folded by the server's `groupId`, in the order their newest member was listed.
 * Groups that look like transaction alerts come first; the order within each half is kept.
 */
export function groupMessages(messages: InboxMessage[]): SampleGroup[] {
  const groups = new Map<string, SampleGroup>()
  for (const message of messages) {
    const found = groups.get(message.groupId)
    if (found) {
      found.members.push(message)
      found.likely ||= message.likely
      continue
    }
    groups.set(message.groupId, {
      id: message.groupId,
      senderEmail: message.senderEmail,
      senderName: message.senderName,
      representative: message,
      members: [message],
      likely: message.likely,
    })
  }
  const all = [...groups.values()]
  return [...all.filter((g) => g.likely), ...all.filter((g) => !g.likely)]
}

/** Newly listed messages join the ones already loaded; an id seen before keeps its place. */
export function mergeMessages(
  loaded: InboxMessage[],
  incoming: InboxMessage[],
): InboxMessage[] {
  const seen = new Set(loaded.map((m) => m.id))
  return [...loaded, ...incoming.filter((m) => !seen.has(m.id))]
}

/** The group's other members, as the learner reads them — capped by the server's sample limit. */
export const similarOf = (group: SampleGroup, max: number): EmailSample[] =>
  group.members
    .filter((m) => m.id !== group.representative.id)
    .slice(0, Math.max(max - 1, 0))
    .map(sampleOf)

const lowerSenders = (senders: string[]) =>
  new Set(senders.map((s) => s.toLowerCase()))

/** Groups from the rule's own senders first, so editing a rule starts where its mail is. */
export function groupsForSenders(
  groups: SampleGroup[],
  senders: string[],
): SampleGroup[] {
  const wanted = lowerSenders(senders)
  if (wanted.size === 0) return groups
  const own = groups.filter((g) => wanted.has(g.senderEmail.toLowerCase()))
  return [...own, ...groups.filter((g) => !own.includes(g))]
}
