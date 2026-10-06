import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ValidationPayload } from '../api/types'

/**
 * Places server validation messages next to the matching inputs. Anything the
 * form has no field for is surfaced as a form-level error instead of being
 * silently dropped.
 */
export function applyServerErrors<T extends FieldValues>(
  payload: ValidationPayload,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): void {
  const unmatched: string[] = []

  for (const [field, messages] of Object.entries(payload)) {
    const message = messages[0] ?? 'Invalid value.'
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message })
    } else {
      unmatched.push(message)
    }
  }

  if (unmatched.length > 0) {
    setError('root' as Path<T>, { type: 'server', message: unmatched.join(' ') })
  }
}
