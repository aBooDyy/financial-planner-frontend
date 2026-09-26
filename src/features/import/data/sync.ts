import { db } from '#/db/db'
import { importTemplatesApi } from '#/features/import/api/importTemplatesApi'
import { ApiError } from '#/lib/apiError'
import { serverTemplateToLocal } from './mappers'
import type { OutboxEntry } from '#/db/types'
import type {
  CreateImportTemplateWire,
  ImportTemplate,
  UpdateImportTemplateWire,
} from '#/features/import/api/types'

/**
 * Push/pull for saved mappings. It follows the other features — 409 rebases and retries
 * once, 404 drops the local row, network errors bubble up — with one branch that matters:
 * `import.template.name_taken` is a **name** conflict, not a version conflict. Rebasing it
 * would re-send the same refused name forever, so the row is flagged and parked instead.
 */

const NAME_TAKEN = 'import.template.name_taken'

const statusOf = (e: unknown): number => (e instanceof ApiError ? e.status : -1)
const codeOf = (e: unknown): string => (e instanceof ApiError ? e.code : '')

const isNameTaken = (e: unknown): boolean =>
  statusOf(e) === 409 && codeOf(e) === NAME_TAKEN

/** Park the row for the user to rename, and drop the op that can never succeed as it is. */
async function parkNameConflict(entry: OutboxEntry): Promise<void> {
  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    const local = await db.importTemplates.get(entry.id)
    if (local) await db.importTemplates.put({ ...local, nameConflict: 1 })
    await db.outbox.delete(entry.seq)
  })
}

async function store(
  entry: OutboxEntry,
  template: ImportTemplate,
): Promise<void> {
  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    const local = await db.importTemplates.get(entry.id)
    // A blob this client cannot read is kept as the row says it is: unreadable here, and
    // untouched on the server. Nothing local is worth writing over it.
    await db.importTemplates.put({
      ...serverTemplateToLocal(template),
      config: template.config ?? local?.config ?? null,
    })
    await db.outbox.delete(entry.seq)
  })
}

async function pushCreate(entry: OutboxEntry): Promise<void> {
  try {
    const template = await importTemplatesApi.create(
      entry.payload as CreateImportTemplateWire,
    )
    await store(entry, template)
  } catch (e) {
    if (isNameTaken(e)) return parkNameConflict(entry)
    if (statusOf(e) === 409) {
      // The id already exists server-side (a second device pushed the same row).
      await db.outbox.delete(entry.seq)
      await pullImportTemplates()
      return
    }
    throw e
  }
}

async function pushUpdate(entry: OutboxEntry): Promise<void> {
  try {
    const template = await importTemplatesApi.update(
      entry.id,
      entry.payload as UpdateImportTemplateWire,
    )
    await store(entry, template)
  } catch (e) {
    if (isNameTaken(e)) return parkNameConflict(entry)
    const status = statusOf(e)
    if (status === 409) return rebase(entry)
    if (status === 404) {
      await db.transaction('rw', db.importTemplates, db.outbox, async () => {
        await db.importTemplates.delete(entry.id)
        await db.outbox.delete(entry.seq)
      })
      return
    }
    throw e
  }
}

/**
 * Version conflict: re-send **this patch** on the server's current version. Because the
 * endpoint is a true partial, re-applying only the fields this op changed is both the
 * client's latest intent and the narrowest possible overwrite — a rename from here does
 * not undo a use bump made elsewhere.
 */
async function rebase(entry: OutboxEntry): Promise<void> {
  const fresh = (await importTemplatesApi.list()).find((t) => t.id === entry.id)
  if (!fresh) {
    await db.outbox.delete(entry.seq)
    return
  }
  const patch = entry.payload as UpdateImportTemplateWire
  try {
    const template = await importTemplatesApi.update(entry.id, {
      ...patch,
      version: fresh.version,
    })
    await store(entry, template)
  } catch (e) {
    if (isNameTaken(e)) return parkNameConflict(entry)
    if (statusOf(e) !== 409) throw e
    // Still conflicting — accept server truth rather than loop.
    await db.transaction('rw', db.importTemplates, db.outbox, async () => {
      await db.importTemplates.put(serverTemplateToLocal(fresh))
      await db.outbox.delete(entry.seq)
    })
  }
}

async function pushDelete(entry: OutboxEntry): Promise<void> {
  try {
    await importTemplatesApi.remove(entry.id)
  } catch (e) {
    if (statusOf(e) !== 404) throw e // 404 ⇒ already gone, treat as success
  }
  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    await db.importTemplates.delete(entry.id)
    await db.outbox.delete(entry.seq)
  })
}

export async function pullImportTemplates(): Promise<void> {
  const server = await importTemplatesApi.list()
  const ids = new Set(server.map((t) => t.id))
  await db.transaction('rw', db.importTemplates, async () => {
    for (const t of server) {
      const local = await db.importTemplates.get(t.id)
      // Local edits win until they've been pushed.
      if (!local || (local.dirty === 0 && local.deleted === 0)) {
        await db.importTemplates.put(serverTemplateToLocal(t))
      }
    }
    for (const l of await db.importTemplates.toArray()) {
      if (l.dirty === 0 && !ids.has(l.id)) {
        await db.importTemplates.delete(l.id)
      }
    }
  })
}

/** Push one import-template outbox entry. Throws on network/unexpected errors. */
export async function pushImportTemplatesEntry(
  entry: OutboxEntry,
): Promise<void> {
  if (entry.op === 'create') return pushCreate(entry)
  if (entry.op === 'update') return pushUpdate(entry)
  return pushDelete(entry)
}
