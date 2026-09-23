/**
 * File-level failures the CSV reader raises. They are codes, not prose, so the wizard and
 * the worker boundary speak the same language as the backend's `ApiError.code` — row-level
 * codes (`import.row.*`) belong to the validator and are a separate vocabulary.
 */
export const CSV_FILE_ERRORS = {
  empty: 'import.file.empty',
  tooLarge: 'import.file.too_large',
  tooManyRows: 'import.file.too_many_rows',
  singleColumn: 'import.file.single_column',
  unreadable: 'import.file.unreadable',
  cancelled: 'import.file.cancelled',
} as const

export type CsvFileErrorCode =
  (typeof CSV_FILE_ERRORS)[keyof typeof CSV_FILE_ERRORS]

export type CsvErrorPayload = { code: CsvFileErrorCode; detail?: string }

export class CsvFileError extends Error {
  readonly code: CsvFileErrorCode
  readonly detail: string | undefined

  constructor(code: CsvFileErrorCode, detail?: string) {
    super(code)
    this.name = 'CsvFileError'
    this.code = code
    this.detail = detail
  }
}

/** Flatten a thrown value into something `postMessage` can carry without losing the code. */
export const csvErrorPayload = (error: unknown): CsvErrorPayload => {
  if (error instanceof CsvFileError) {
    return error.detail === undefined
      ? { code: error.code }
      : { code: error.code, detail: error.detail }
  }
  return {
    code: CSV_FILE_ERRORS.unreadable,
    detail: error instanceof Error ? error.message : String(error),
  }
}

export const csvErrorFromPayload = (payload: CsvErrorPayload): CsvFileError =>
  new CsvFileError(payload.code, payload.detail)
