import type { ApiErrorType, ValidationPayload } from './types'

export class ApiError extends Error {
  readonly status: number
  readonly type: ApiErrorType | 'UnknownException'
  readonly payload: ValidationPayload | undefined

  constructor(
    status: number,
    type: ApiErrorType | 'UnknownException',
    message: string,
    payload?: ValidationPayload,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.type = type
    this.payload = payload
  }
}

export interface ValidationError extends ApiError {
  payload: ValidationPayload
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isValidationError(error: unknown): error is ValidationError {
  return isApiError(error) && error.status === 422 && error.payload !== undefined
}
