import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '#/lib/apiError'
import { messageForCode } from '#/lib/errorMessages'

/**
 * Routes a thrown {@link ApiError} into a react-hook-form: field-level `details` become
 * per-field errors; anything left over is returned as a single form-level message (or null
 * when every problem was attached to a field).
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): string | null {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.'
  }

  let attachedToField = false
  for (const detail of error.details) {
    if ((fields as ReadonlyArray<string>).includes(detail.field)) {
      setError(detail.field as Path<T>, {
        message: messageForCode(detail.code),
      })
      attachedToField = true
    }
  }

  return attachedToField ? null : messageForCode(error.code)
}
