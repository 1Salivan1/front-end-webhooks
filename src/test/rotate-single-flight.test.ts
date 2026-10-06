import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchMe } from '../api/auth'
import { login } from '../api/auth'
import { __resetClient } from '../api/client'
import { ApiError } from '../api/errors'
import { fetchWebhooks } from '../api/webhooks'
import { onSessionExpired } from '../auth/sessionEvents'
import { CREDENTIALS, __resetDb } from '../mocks/db'
import { server } from '../mocks/server'
import { __expireSessionNow, __resetSession, revokeSession } from '../mocks/session'

/** Counts how many times the client actually called the rotate endpoint. */
function countRotateCalls(): () => number {
  let calls = 0
  const listener = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname === '/auth/token/rotate') calls += 1
  }
  server.events.on('request:start', listener)
  return () => calls
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.events.removeAllListeners()
  server.resetHandlers()
  __resetClient()
  __resetSession()
  __resetDb()
})

afterAll(() => {
  server.close()
})

beforeEach(async () => {
  await login({ email: CREDENTIALS.email, password: CREDENTIALS.password })
})

describe('concurrent 401s', () => {
  it('shares a single rotate and retries both requests successfully', async () => {
    const rotateCalls = countRotateCalls()
    __expireSessionNow()

    // Both requests are in flight before either response arrives, so both get a 401.
    const [webhooks, me] = await Promise.all([
      fetchWebhooks({ page: 1, search: '' }),
      fetchMe(),
    ])

    expect(rotateCalls()).toBe(1)
    expect(webhooks.data).toHaveLength(10)
    expect(webhooks.paging.results.total).toBe(27)
    expect(me.email).toBe(CREDENTIALS.email)
  })

  it('ends the session once when the shared rotate fails', async () => {
    const rotateCalls = countRotateCalls()
    const onExpired = vi.fn()
    const unsubscribe = onSessionExpired(onExpired)

    // Revoking leaves no session to rotate, so rotate answers 400.
    revokeSession()

    const results = await Promise.allSettled([
      fetchWebhooks({ page: 1, search: '' }),
      fetchMe(),
    ])

    unsubscribe()

    expect(rotateCalls()).toBe(1)
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    for (const result of results) {
      expect(result.status === 'rejected' && result.reason).toBeInstanceOf(ApiError)
    }
    expect(onExpired).toHaveBeenCalledTimes(1)
  })
})
