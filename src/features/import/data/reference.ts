/**
 * `t_transactions` has one `source` column and no metadata field, and the batch marker has
 * to win it (undo depends on it), so a mapped reference rides at the end of the note.
 */
export const REFERENCE_MARK = ' · ref:'

const REFERENCE_RE = /(?:^|\s·\s)ref:([^·]+)$/

export const referenceFromNote = (note: string | null): string | null => {
  const match = note === null ? null : REFERENCE_RE.exec(note)
  return match ? match[1].trim() : null
}

export const stripReference = (note: string | null): string | null => {
  if (note === null) return null
  const stripped = note.replace(REFERENCE_RE, '').trim()
  return stripped === '' ? null : stripped
}

/** Append the bank's reference to the note it will be committed with. */
export const withReference = (
  note: string | null,
  reference: string | null,
): string | null => {
  if (reference === null || reference === '') return note
  if (note === null || note === '') return `ref:${reference}`
  return `${note}${REFERENCE_MARK}${reference}`
}
