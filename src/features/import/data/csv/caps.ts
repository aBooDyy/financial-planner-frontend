import { CSV_FILE_ERRORS, CsvFileError } from './errors'

/**
 * The file caps, as plain numbers. The live values come from the server's config `limits`
 * block, but this module stays free of the config store so the worker — which has its own
 * module registry and would only see the bundled snapshot — can enforce what it is told.
 */
export type ImportLimits = { maxRows: number; maxBytes: number }

export const toImportLimits = (limits: {
  importMaxRows: number
  importMaxBytes: number
}): ImportLimits => ({
  maxRows: limits.importMaxRows,
  maxBytes: limits.importMaxBytes,
})

export const assertFileSize = (bytes: number, limits: ImportLimits): void => {
  if (bytes === 0) throw new CsvFileError(CSV_FILE_ERRORS.empty)
  if (bytes > limits.maxBytes) {
    throw new CsvFileError(CSV_FILE_ERRORS.tooLarge, String(bytes))
  }
}

export const assertRowCount = (rows: number, limits: ImportLimits): void => {
  if (rows === 0) throw new CsvFileError(CSV_FILE_ERRORS.empty)
  if (rows > limits.maxRows) {
    throw new CsvFileError(CSV_FILE_ERRORS.tooManyRows, String(rows))
  }
}
