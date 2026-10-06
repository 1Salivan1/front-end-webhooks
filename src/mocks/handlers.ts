import { HttpResponse, http, type DefaultBodyType, type HttpResponseResolver } from 'msw'
import { BASE_URL } from '../api/baseUrl'
import type { ApiErrorBody, ApiErrorType, ValidationPayload } from '../api/types'
import {
  CREDENTIALS,
  USER,
  findWebhook,
  listWebhooks,
  updateWebhook,
  validateWebhookInput,
} from './db'
import {
  consumeDeviceSessionToken,
  isSessionValid,
  issueDeviceSessionToken,
  revokeSession,
  rotateSession,
  startSession,
} from './session'

export const CSRF_TOKEN = 'f3c1a9d4e8b24f6a9c0d5e7b1a3f8c2d'
export const PAGE_SIZE = 10

function errorResponse(
  status: number,
  type: ApiErrorType,
  message: string,
  payload?: ValidationPayload,
) {
  const body: ApiErrorBody = {
    error: payload === undefined ? { type, message } : { type, message, payload },
  }
  return HttpResponse.json<ApiErrorBody>(body, { status })
}

const unauthorized = () =>
  errorResponse(401, 'AuthenticationException', 'Unauthenticated.')

const invalidData = (payload: ValidationPayload) =>
  errorResponse(422, 'ValidationException', 'The given data was invalid.', payload)

/**
 * CSRF guard for POST/PUT. Runs before the operation itself, so a rejected
 * request never mutates state.
 */
function withCsrf<P extends Record<string, string>>(
  resolver: HttpResponseResolver<P, DefaultBodyType, undefined>,
): HttpResponseResolver<P, DefaultBodyType, undefined> {
  return (info) => {
    if (info.request.headers.get('X-CSRF-TOKEN') !== CSRF_TOKEN) {
      return errorResponse(419, 'TokenMismatchException', 'CSRF token mismatch.')
    }
    return resolver(info)
  }
}

/** Session guard for /v1/* resources. */
function withSession<P extends Record<string, string>>(
  resolver: HttpResponseResolver<P, DefaultBodyType, undefined>,
): HttpResponseResolver<P, DefaultBodyType, undefined> {
  return (info) => (isSessionValid() ? resolver(info) : unauthorized())
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function isValidFingerprint(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/.test(value)
}

export const handlers = [
  http.get(`${BASE_URL}/csrf`, () => new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': CSRF_TOKEN } })),

  http.post(
    `${BASE_URL}/auth/login`,
    withCsrf(async ({ request }) => {
      const captcha = request.headers.get('X-Captcha-Token')
      if (captcha === null || captcha === '') {
        return invalidData({ captcha: ['The captcha token is required.'] })
      }

      const body = await readJson(request)
      if (!isValidFingerprint(body['fingerprint'])) {
        return invalidData({ fingerprint: ['The fingerprint is invalid.'] })
      }
      if (body['email'] !== CREDENTIALS.email) {
        return invalidData({ email: ['These credentials do not match our records.'] })
      }
      if (body['password'] !== CREDENTIALS.password) {
        return invalidData({ password: ['The provided password is incorrect.'] })
      }

      return HttpResponse.json({ device_session_token: issueDeviceSessionToken() })
    }),
  ),

  http.post(
    `${BASE_URL}/auth/token/issue`,
    withCsrf(async ({ request }) => {
      const body = await readJson(request)
      if (!isValidFingerprint(body['fingerprint'])) {
        return invalidData({ fingerprint: ['The fingerprint is invalid.'] })
      }

      const token = body['device_session_token']
      if (typeof token !== 'string' || !consumeDeviceSessionToken(token)) {
        return invalidData({ device_session_token: ['The device session token is invalid.'] })
      }

      startSession()
      return HttpResponse.json({ status: 'ok' })
    }),
  ),

  http.post(
    `${BASE_URL}/auth/token/rotate`,
    withCsrf(async ({ request }) => {
      const body = await readJson(request)
      if (!isValidFingerprint(body['fingerprint']) || !rotateSession()) {
        return errorResponse(400, 'BadRequestException', 'Unable to rotate the session.')
      }
      return HttpResponse.json({ status: 'ok' })
    }),
  ),

  http.post(
    `${BASE_URL}/auth/token/revoke`,
    withCsrf(() => {
      revokeSession()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    `${BASE_URL}/v1/me`,
    withSession(() => HttpResponse.json(USER)),
  ),

  http.get(
    `${BASE_URL}/v1/webhooks`,
    withSession(({ request }) => {
      const params = new URL(request.url).searchParams
      const page = Number.parseInt(params.get('page') ?? '1', 10)
      const limit = Number.parseInt(params.get('limit') ?? String(PAGE_SIZE), 10)

      return HttpResponse.json(
        listWebhooks({
          page: Number.isFinite(page) && page > 0 ? page : 1,
          limit: Number.isFinite(limit) && limit > 0 ? limit : PAGE_SIZE,
          search: params.get('search') ?? '',
        }),
      )
    }),
  ),

  http.get<{ id: string }>(
    `${BASE_URL}/v1/webhooks/:id`,
    withSession(({ params }) => {
      const webhook = findWebhook(Number(params.id))
      return webhook === undefined
        ? errorResponse(404, 'NotFoundException', 'Webhook not found.')
        : HttpResponse.json(webhook)
    }),
  ),

  http.put<{ id: string }>(
    `${BASE_URL}/v1/webhooks/:id`,
    withCsrf(
      withSession(async ({ params, request }) => {
        if (findWebhook(Number(params.id)) === undefined) {
          return errorResponse(404, 'NotFoundException', 'Webhook not found.')
        }

        const body = await readJson(request)
        const errors = validateWebhookInput({ name: body['name'], url: body['url'] })
        if (errors !== null) return invalidData(errors)

        const updated = updateWebhook(Number(params.id), {
          name: body['name'] as string,
          url: body['url'] as string,
        })
        return updated === undefined
          ? errorResponse(404, 'NotFoundException', 'Webhook not found.')
          : HttpResponse.json(updated)
      }),
    ),
  ),
]
