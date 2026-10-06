import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { login } from '../api/auth'
import { BASE_URL } from '../api/baseUrl'
import { __resetClient } from '../api/client'
import { updateWebhook } from '../api/webhooks'
import { CREDENTIALS, __resetDb } from '../mocks/db'
import { server } from '../mocks/server'
import { __resetSession } from '../mocks/session'

function countCalls(pathname: string): () => number {
  let calls = 0
  server.events.on('request:start', ({ request }) => {
    if (new URL(request.url).pathname === pathname) calls += 1
  })
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

describe('CSRF handling', () => {
  it('fetches a fresh token and retries once after a 419', async () => {
    const csrfCalls = countCalls('/csrf')
    const putCalls = countCalls('/v1/webhooks/1')
    const callsBefore = csrfCalls()

    // The first PUT is answered with a token mismatch, the retry goes through.
    server.use(
      http.put(
        `${BASE_URL}/v1/webhooks/:id`,
        () =>
          HttpResponse.json(
            { error: { type: 'TokenMismatchException', message: 'CSRF token mismatch.' } },
            { status: 419 },
          ),
        { once: true },
      ),
    )

    const updated = await updateWebhook(1, {
      name: 'Renamed hook',
      url: 'https://hooks.example.com/renamed',
    })

    expect(updated.name).toBe('Renamed hook')
    expect(putCalls()).toBe(2)
    // The cached token was dropped and re-fetched exactly once.
    expect(csrfCalls() - callsBefore).toBe(1)
  })
})
