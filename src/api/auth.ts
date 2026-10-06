import { getFingerprint } from '../auth/fingerprint'
import { markSessionEnded, markSessionStarted, request } from './client'
import type { LoginResponse, Me } from './types'

/** The mock accepts any non-empty value; no captcha widget is required. */
const CAPTCHA_TOKEN = 'test-captcha-token'

/**
 * Exchanges credentials for a session.
 *
 * The device_session_token lives only as a local variable between the two
 * calls below: it is never stored in state, localStorage or the URL.
 */
export async function login(credentials: { email: string; password: string }): Promise<void> {
  const fingerprint = getFingerprint()

  const { device_session_token } = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { ...credentials, fingerprint },
    headers: { 'X-Captcha-Token': CAPTCHA_TOKEN },
    skipAuthRetry: true,
  })

  await request<unknown>('/auth/token/issue', {
    method: 'POST',
    body: { device_session_token, fingerprint },
    skipAuthRetry: true,
  })

  markSessionStarted()
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/token/revoke', {
      method: 'POST',
      body: { fingerprint: getFingerprint() },
      skipAuthRetry: true,
    })
  } finally {
    markSessionEnded()
  }
}

export function fetchMe(): Promise<Me> {
  return request<Me>('/v1/me')
}
