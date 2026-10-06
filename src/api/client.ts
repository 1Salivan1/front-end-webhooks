import { getFingerprint } from '../auth/fingerprint'
import { BASE_URL } from './baseUrl'
import { emitSessionExpired } from '../auth/sessionEvents'
import { ApiError } from './errors'
import type { ApiErrorBody, ApiErrorType, ValidationPayload } from './types'

const CSRF_HEADER = 'X-CSRF-TOKEN'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  searchParams?: Record<string, string | number | undefined>
  headers?: Record<string, string>
  /** Auth endpoints opt out of the 401 retry so a rotate can never trigger a rotate. */
  skipAuthRetry?: boolean
}

interface Attempted {
  csrf: boolean
  auth: boolean
}

// --- CSRF -------------------------------------------------------------------

let csrfToken: string | null = null
let csrfPromise: Promise<string> | null = null

/**
 * Fetched once before the first other API request, then cached. Concurrent
 * callers share a single in-flight request.
 */
async function ensureCsrfToken(): Promise<string> {
  if (csrfToken !== null) return csrfToken

  csrfPromise ??= fetch(`${BASE_URL}/csrf`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
    .then((response) => {
      const token = response.headers.get(CSRF_HEADER)
      if (token === null) {
        throw new ApiError(response.status, 'UnknownException', 'CSRF token is missing.')
      }
      csrfToken = token
      return token
    })
    .finally(() => {
      csrfPromise = null
    })

  return csrfPromise
}

// --- Session rotation -------------------------------------------------------

/**
 * Bumped on every event that makes the session fresh (issue, rotate). A request
 * captures the epoch before it is sent; a 401 carrying a stale epoch means the
 * session was already refreshed while the request was in flight, so it must be
 * retried without starting a second rotate.
 */
let sessionEpoch = 0
let rotatePromise: Promise<void> | null = null
/** Guards against emitting "session expired" once per failed parallel request. */
let sessionLive = false

export function markSessionStarted(): void {
  sessionEpoch += 1
  sessionLive = true
}

export function markSessionEnded(): void {
  sessionLive = false
  rotatePromise = null
}

function terminateSession(): void {
  if (!sessionLive) return
  sessionLive = false
  emitSessionExpired()
}

async function rotateOnce(): Promise<void> {
  await request<unknown>('/auth/token/rotate', {
    method: 'POST',
    body: { fingerprint: getFingerprint() },
    skipAuthRetry: true,
  })
  sessionEpoch += 1
}

/**
 * Single-flight: every request that hit a 401 at the same epoch awaits the very
 * same rotate call.
 */
async function refreshSession(epochAtRequest: number): Promise<void> {
  if (epochAtRequest !== sessionEpoch) return


  rotatePromise ??= rotateOnce().finally(() => {
    rotatePromise = null
  })

  try {
    await rotatePromise
  } catch (error) {
    terminateSession()
    throw error
  }
}

// --- Core request -----------------------------------------------------------

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return send<T>(path, options, { csrf: false, auth: false })
}

async function send<T>(path: string, options: RequestOptions, attempted: Attempted): Promise<T> {
  const method = options.method ?? 'GET'
  const token = await ensureCsrfToken()

  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...options.headers,
  }
  if (method === 'POST' || method === 'PUT') {
    headers[CSRF_HEADER] = token
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  // Captured before the request leaves, so a late 401 can be told apart from a
  // genuinely expired session.
  const epochAtRequest = sessionEpoch

  const response = await fetch(buildUrl(path, options.searchParams), {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })

  if (response.ok) return parseBody<T>(response)

  if (response.status === 419 && !attempted.csrf) {
    csrfToken = null
    return send<T>(path, options, { ...attempted, csrf: true })
  }

  if (response.status === 401 && options.skipAuthRetry !== true && !attempted.auth) {
    await refreshSession(epochAtRequest)
    return send<T>(path, options, { ...attempted, auth: true })
  }

  // A 401 that survived a successful rotate means the session is really gone.
  if (response.status === 401 && options.skipAuthRetry !== true) {
    terminateSession()
  }

  throw await toApiError(response)
}

function buildUrl(path: string, searchParams: RequestOptions['searchParams']): string {
  if (searchParams === undefined) return `${BASE_URL}${path}`

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }

  const queryString = query.toString()
  return queryString === '' ? `${BASE_URL}${path}` : `${BASE_URL}${path}?${queryString}`
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (text === '') return undefined as T
  // Trusted boundary: the contract is enforced by the mock and typed by callers.
  return JSON.parse(text) as T
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (isApiErrorBody(body)) {
    return new ApiError(response.status, body.error.type, body.error.message, body.error.payload)
  }

  return new ApiError(response.status, 'UnknownException', `Request failed with ${response.status}.`)
}

const ERROR_TYPES = new Set<string>([
  'BadRequestException',
  'AuthenticationException',
  'NotFoundException',
  'TokenMismatchException',
  'ValidationException',
] satisfies ApiErrorType[])

function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false
  const error: unknown = (body as { error: unknown }).error
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { type?: unknown; message?: unknown; payload?: unknown }
  return typeof candidate.type === 'string' && ERROR_TYPES.has(candidate.type)
}

/** Test hook: drop all cached client state between tests. */
export function __resetClient(): void {
  csrfToken = null
  csrfPromise = null
  rotatePromise = null
  sessionEpoch = 0
  sessionLive = false
}

export type { ValidationPayload }
