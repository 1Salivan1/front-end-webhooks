/**
 * Server-side session state. This is the mock's analogue of an HttpOnly cookie:
 * the client never receives or sees any of these values.
 */

export const SESSION_TTL_MS = 30_000

/** device_session_token values handed out by /auth/login and not yet exchanged. */
const issuedDeviceTokens = new Set<string>()

/**
 * Whether a session was ever established and not revoked. Kept apart from the
 * expiry: an expired session can still be rotated, which is exactly what the
 * client's 401 -> rotate -> retry flow relies on. Only "before issue" and
 * "after revoke" make rotate fail.
 */
let sessionEstablished = false
let sessionExpiresAt = 0

export function issueDeviceSessionToken(): string {
  const token = `dst_${crypto.randomUUID()}`
  issuedDeviceTokens.add(token)
  return token
}

export function consumeDeviceSessionToken(token: string): boolean {
  return issuedDeviceTokens.delete(token)
}

export function startSession(): void {
  sessionEstablished = true
  sessionExpiresAt = Date.now() + SESSION_TTL_MS
}

export function isSessionValid(): boolean {
  return sessionEstablished && Date.now() < sessionExpiresAt
}

/** Extends the session by another TTL. Fails only when there is no session at all. */
export function rotateSession(): boolean {
  if (!sessionEstablished) return false
  sessionExpiresAt = Date.now() + SESSION_TTL_MS
  return true
}

export function revokeSession(): void {
  sessionEstablished = false
  sessionExpiresAt = 0
}

/** Test hook: expire the session deterministically, without fake timers. */
export function __expireSessionNow(): void {
  sessionExpiresAt = Date.now() - 1
}

/** Test hook: reset all mock session state between tests. */
export function __resetSession(): void {
  issuedDeviceTokens.clear()
  sessionEstablished = false
  sessionExpiresAt = 0
}
