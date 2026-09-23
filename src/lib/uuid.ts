const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for the canonical 8-4-4-4-12 hex form every server id takes. */
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID.test(value)
