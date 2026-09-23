import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '#/db/db'
import type { LocalInboundImport } from '#/db/types'

/** Reactive list of pending auto-logged imports awaiting review, newest first. */
export function usePendingImports(): {
  imports: LocalInboundImport[]
  count: number
} {
  const rows = useLiveQuery(() => db.inboundImports.toArray())
  const imports = (rows ?? [])
    .filter((r) => r.status === 'pending')
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return { imports, count: imports.length }
}
