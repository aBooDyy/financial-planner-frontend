import type { LocalEmailConnection } from '#/db/types'
import type { EmailConnection } from '#/features/email-sync/api/types'

export const connectionToLocal = (
  c: EmailConnection,
): LocalEmailConnection => ({ ...c })
