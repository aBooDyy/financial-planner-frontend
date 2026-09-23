import type { LocalIntegrationKey } from '#/db/types'
import { KeyRow } from './KeyRow'

type Props = {
  keys: LocalIntegrationKey[]
  walletNames: ReadonlyMap<string, string>
  online: boolean
  onEdit: (key: LocalIntegrationKey) => void
  onRotate: (key: LocalIntegrationKey) => void
  onRevoke: (key: LocalIntegrationKey) => void
  onDelete: (key: LocalIntegrationKey) => void
}

export function KeyList({
  keys,
  walletNames,
  online,
  onEdit,
  onRotate,
  onRevoke,
  onDelete,
}: Props) {
  return (
    <ul
      aria-label="Integration keys"
      className="overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp"
    >
      {keys.map((k) => (
        <KeyRow
          key={k.id}
          apiKey={k}
          walletName={
            k.defaultWalletId
              ? (walletNames.get(k.defaultWalletId) ?? null)
              : null
          }
          online={online}
          onEdit={() => onEdit(k)}
          onRotate={() => onRotate(k)}
          onRevoke={() => onRevoke(k)}
          onDelete={() => onDelete(k)}
        />
      ))}
    </ul>
  )
}
