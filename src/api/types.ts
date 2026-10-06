export interface Me {
  id: number
  email: string
  first_name: string
  last_name: string
  name: string
}

export interface Webhook {
  id: number
  name: string
  url: string
  active: boolean
  created_at: string
}

export interface Paging {
  pages: { current: number; last: number }
  results: { total: number; limitation: number }
}

export interface WebhookList {
  data: Webhook[]
  paging: Paging
}

export type ApiErrorType =
  | 'BadRequestException'
  | 'AuthenticationException'
  | 'NotFoundException'
  | 'TokenMismatchException'
  | 'ValidationException'

/** Field name -> list of messages. Only present on ValidationException. */
export type ValidationPayload = Record<string, string[]>

export interface ApiErrorBody {
  error: {
    type: ApiErrorType
    message: string
    payload?: ValidationPayload
  }
}

export interface LoginResponse {
  device_session_token: string
}
