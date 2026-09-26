import { CloudOff, TriangleAlert } from 'lucide-react'
import type { SyncFailure } from '#/db/types'
import { cn } from '#/lib/utils'

/** Amber cloud while the server is out of reach; red warning once it has refused the change. */
export function SyncFailureIcon({
  kind,
  size = 15,
  className,
}: {
  kind: SyncFailure['kind']
  size?: number
  className?: string
}) {
  const Glyph = kind === 'unavailable' ? CloudOff : TriangleAlert
  return (
    <Glyph
      aria-hidden
      size={size}
      strokeWidth={2.1}
      className={cn(
        kind === 'unavailable' ? 'text-fp-warn' : 'text-fp-danger',
        className,
      )}
    />
  )
}
