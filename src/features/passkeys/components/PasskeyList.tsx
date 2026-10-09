import { KeyRound } from 'lucide-react'
import { EmptyState } from '#/components/EmptyState'
import { Skeleton } from '#/components/ui/skeleton'
import type { Passkey } from '#/features/passkeys/api/types'
import { PasskeyRow } from './PasskeyRow'

const CARD =
  'overflow-hidden rounded-2xl border border-fp-border bg-fp-surface shadow-fp'

type Props = {
  /** Null while the first answer is on its way. */
  passkeys: Passkey[] | null
  online: boolean
  onRename: (passkey: Passkey) => void
  onRemove: (passkey: Passkey) => void
}

function LoadingRow() {
  return (
    <li
      aria-hidden
      className="flex items-center gap-3 border-b border-fp-border px-[18px] py-[13px] last:border-b-0"
    >
      <Skeleton className="size-9 shrink-0 rounded-[11px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-40 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
    </li>
  )
}

export function PasskeyList({ passkeys, online, onRename, onRemove }: Props) {
  if (passkeys === null)
    return (
      <ul aria-busy="true" aria-label="Loading passkeys" className={CARD}>
        <LoadingRow />
        <LoadingRow />
      </ul>
    )

  if (passkeys.length === 0)
    return (
      <EmptyState
        framed
        icon={KeyRound}
        title="No passkeys yet"
        text="A passkey lets you sign in with Face ID, Touch ID or your device’s screen lock instead of your password. It stays on your device; Means never sees it."
      />
    )

  return (
    <ul aria-label="Passkeys" className={CARD}>
      {passkeys.map((p) => (
        <PasskeyRow
          key={p.id}
          passkey={p}
          online={online}
          onRename={() => onRename(p)}
          onRemove={() => onRemove(p)}
        />
      ))}
    </ul>
  )
}
