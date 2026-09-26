import type { LocalEmailConnection } from '#/db/types'
import { InboxRow } from './InboxRow'

type Props = {
  connections: LocalEmailConnection[]
  online: boolean
  onEdit: (connection: LocalEmailConnection) => void
  onAddRule: (connection: LocalEmailConnection) => void
  onDisconnect: (connection: LocalEmailConnection) => void
}

export function InboxList({
  connections,
  online,
  onEdit,
  onAddRule,
  onDisconnect,
}: Props) {
  return (
    <ul
      aria-label="Connected inboxes"
      className="overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp"
    >
      {connections.map((c) => (
        <InboxRow
          key={c.id}
          connection={c}
          online={online}
          onEdit={() => onEdit(c)}
          onAddRule={() => onAddRule(c)}
          onDisconnect={() => onDisconnect(c)}
        />
      ))}
    </ul>
  )
}
