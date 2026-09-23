import { db } from '#/db/db'
import { schedulePush } from '#/db/sync'
import {
  MAX_CONFIG_BYTES,
  configByteLength,
  serializeTemplateConfig,
} from '#/features/import/api/types'
import { ApiError } from '#/lib/apiError'
import { localTemplateToCreateWire } from './mappers'
import type { LocalImportTemplate } from '#/db/types'
import type { UpdateImportTemplateWire } from '#/features/import/api/types'
import type { ImportTemplateConfig } from './types'

/**
 * Optimistic, local-first writes for saved mappings: Dexie first, outbox second, one
 * debounced push. A template is never created behind the user's back — every call here is
 * an explicit choice made in the wizard footer or in Settings.
 */

export const MAX_TEMPLATE_NAME = 120

const now = () => new Date().toISOString()
const newId = () => crypto.randomUUID()

const pending = (id: string) =>
  db.outbox.where('[entity+id]').equals(['importTemplate', id])

// Raised locally so the UI has one error channel, and so a name we already know the server
// will refuse costs no round trip. Both codes are the backend's own.
const nameRequired = () =>
  new ApiError({
    code: 'import.template.name_required',
    message: 'Give the template a name.',
    status: 422,
  })

const nameTaken = () =>
  new ApiError({
    code: 'import.template.name_taken',
    message: 'You already have a template with that name.',
    status: 409,
  })

// A mapping that big would be refused by the server; saying so here keeps the failure
// attached to the click that caused it rather than to a silent outbox drop.
const checkSize = (config: ImportTemplateConfig): void => {
  if (configByteLength(config) > MAX_CONFIG_BYTES) {
    throw new ApiError({
      code: 'import.template.config_invalid',
      message: 'That mapping is too large to save.',
      status: 422,
    })
  }
}

const cleanName = (raw: string): string => {
  const name = raw.trim()
  if (name === '' || name.length > MAX_TEMPLATE_NAME) throw nameRequired()
  return name
}

/** The server's uniqueness is on the trimmed name, so ours has to be too. */
async function assertNameFree(name: string, exceptId: string): Promise<void> {
  const clash = await db.importTemplates
    .filter(
      (t) => t.deleted === 0 && t.id !== exceptId && t.name.trim() === name,
    )
    .first()
  if (clash) throw nameTaken()
}

/**
 * Queue one change. `PATCH` is a true partial, so patches merge into a single queued op
 * rather than replacing each other — a rename and a use bump made offline both survive.
 */
async function enqueue(
  template: LocalImportTemplate,
  patch: Omit<UpdateImportTemplateWire, 'version'>,
): Promise<void> {
  const create = await pending(template.id)
    .filter((e) => e.op === 'create')
    .first()
  if (create) {
    create.payload = localTemplateToCreateWire(template)
    await db.outbox.put(create)
    return
  }
  // No version yet means the row has never reached the server — its create was refused
  // (a name clash) and dropped, so the fix is a fresh create, not a patch of nothing.
  if (template.version === '') {
    await db.outbox.add({
      op: 'create',
      entity: 'importTemplate',
      id: template.id,
      payload: localTemplateToCreateWire(template),
      baseVersion: null,
      createdAt: now(),
    })
    return
  }
  const queued = await pending(template.id)
    .filter((e) => e.op === 'update')
    .first()
  if (queued) {
    queued.payload = {
      ...(queued.payload as UpdateImportTemplateWire),
      ...patch,
      version: template.version,
    }
    queued.baseVersion = template.version
    await db.outbox.put(queued)
    return
  }
  await db.outbox.add({
    op: 'update',
    entity: 'importTemplate',
    id: template.id,
    payload: { version: template.version, ...patch },
    baseVersion: template.version,
    createdAt: now(),
  })
}

export type TemplateDraft = {
  name: string
  signature: string
  config: ImportTemplateConfig
}

export async function createImportTemplate(
  draft: TemplateDraft,
): Promise<LocalImportTemplate> {
  const id = newId()
  const name = cleanName(draft.name)
  checkSize(draft.config)
  await assertNameFree(name, id)
  const ts = now()
  const template: LocalImportTemplate = {
    id,
    name,
    sourceKind: 'csv',
    signature: draft.signature,
    config: draft.config,
    lastUsedAt: ts,
    useCount: 1,
    nameConflict: 0,
    createdAt: ts,
    updatedAt: ts,
    version: '',
    dirty: 1,
    deleted: 0,
  }

  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    await db.importTemplates.put(template)
    await db.outbox.add({
      op: 'create',
      entity: 'importTemplate',
      id,
      payload: localTemplateToCreateWire(template),
      baseVersion: null,
      createdAt: ts,
    })
  })
  schedulePush()
  return template
}

/** Renaming is also how a refused name is fixed, so it clears the conflict flag. */
export async function renameImportTemplate(
  id: string,
  rawName: string,
): Promise<void> {
  const existing = await db.importTemplates.get(id)
  if (!existing) return
  const name = cleanName(rawName)
  if (name === existing.name && existing.nameConflict === 0) return
  await assertNameFree(name, id)
  const template: LocalImportTemplate = {
    ...existing,
    name,
    nameConflict: 0,
    updatedAt: now(),
    dirty: 1,
  }
  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    await db.importTemplates.put(template)
    await enqueue(template, { name })
  })
  schedulePush()
}

/** *Update "…"*: the session's mapping replaces the one the template held. */
export async function updateImportTemplateMapping(
  id: string,
  next: { signature: string; config: ImportTemplateConfig },
): Promise<void> {
  const existing = await db.importTemplates.get(id)
  if (!existing) return
  checkSize(next.config)
  const ts = now()
  const template: LocalImportTemplate = {
    ...existing,
    signature: next.signature,
    config: next.config,
    lastUsedAt: ts,
    useCount: existing.useCount + 1,
    updatedAt: ts,
    dirty: 1,
  }
  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    await db.importTemplates.put(template)
    await enqueue(template, {
      signature: next.signature,
      config: serializeTemplateConfig(next.config),
      last_used_at: ts,
      use_count: template.useCount,
    })
  })
  schedulePush()
}

/**
 * Record that a template was imported with. There is no server-side increment and no
 * "record a use" endpoint — this is an ordinary, rebasable patch, and two devices racing
 * it simply agree on whichever landed last.
 */
export async function recordTemplateUse(id: string): Promise<void> {
  const existing = await db.importTemplates.get(id)
  if (!existing) return
  const ts = now()
  const template: LocalImportTemplate = {
    ...existing,
    lastUsedAt: ts,
    useCount: existing.useCount + 1,
    updatedAt: ts,
    dirty: 1,
  }
  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    await db.importTemplates.put(template)
    await enqueue(template, { last_used_at: ts, use_count: template.useCount })
  })
  schedulePush()
}

export async function deleteImportTemplate(id: string): Promise<void> {
  const existing = await db.importTemplates.get(id)
  if (!existing) return
  const neverSynced = existing.version === ''

  await db.transaction('rw', db.importTemplates, db.outbox, async () => {
    await pending(id).delete()
    await db.importTemplates.delete(id)
    if (!neverSynced) {
      await db.outbox.add({
        op: 'delete',
        entity: 'importTemplate',
        id,
        payload: null,
        baseVersion: existing.version,
        createdAt: now(),
      })
    }
  })
  schedulePush()
}

// --- The wizard's save choice --------------------------------------------------------

/**
 * What the footer asked for. A one-time mapping is a first-class answer, not a skipped
 * step: `none` writes no template at all ([ADR-12]).
 */
export type TemplateSavePlan =
  | { mode: 'none' }
  | { mode: 'new'; name: string }
  | { mode: 'update'; id: string }

export type TemplateSaveOutcome =
  | { kind: 'none' }
  | { kind: 'saved'; name: string }
  | { kind: 'updated'; name: string }
  /** The rows are already in — a mapping that could not be saved says so and offers again. */
  | { kind: 'failed'; message: string }

export type TemplateSession = {
  signature: string
  config: ImportTemplateConfig
  /** The saved template this import was mapped with, if any. */
  usedTemplateId: string | null
}

/**
 * Carry out the footer's choice, once the rows are already written. The template a user
 * imported *with* has its counters bumped even when they decline to save the mapping —
 * that use is a fact, and it is what orders the picker next month. `update` bumps them as
 * part of the same patch, so it is not bumped twice.
 */
export async function saveTemplateForImport(
  plan: TemplateSavePlan,
  session: TemplateSession,
): Promise<TemplateSaveOutcome> {
  const bumpUsed = async (skipId: string | null) => {
    const id = session.usedTemplateId
    if (id !== null && id !== skipId) await recordTemplateUse(id)
  }

  if (plan.mode === 'update') {
    await updateImportTemplateMapping(plan.id, {
      signature: session.signature,
      config: session.config,
    })
    await bumpUsed(plan.id)
    const updated = await db.importTemplates.get(plan.id)
    return { kind: 'updated', name: updated?.name ?? plan.id }
  }

  if (plan.mode === 'new') {
    const created = await createImportTemplate({
      name: plan.name,
      signature: session.signature,
      config: session.config,
    })
    await bumpUsed(created.id)
    return { kind: 'saved', name: created.name }
  }

  await bumpUsed(null)
  return { kind: 'none' }
}
