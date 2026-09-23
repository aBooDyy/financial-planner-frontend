// `value` carries the datum the caller needs to recover from the error — today only the
// winning merchant id on `merchants.alias.taken`. Omitted from the wire when unset.
export type FieldError = { field: string; code: string; value?: string }

/**
 * Typed transport error carrying the backend's stable `code` (the i18n key) and optional
 * field-level `details`. The UI translates by `code` and never parses `message`.
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: ReadonlyArray<FieldError>

  constructor(params: {
    code: string
    message: string
    status: number
    details?: ReadonlyArray<FieldError>
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.details = params.details ?? []
  }

  get isUnauthenticated(): boolean {
    return this.status === 401
  }

  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.code
  }

  fieldValue(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.value
  }
}
