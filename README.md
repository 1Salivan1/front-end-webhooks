# Smart Sender — Webhooks

A small SPA: sign-in, a paginated/searchable webhook list, and inline editing.
There is no backend — the whole API is mocked with MSW according to the contract
in the task description, and the mock runs in the browser as a service worker.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # the automated tests
npm run build    # production build into dist/
npm run preview  # serve the production build locally
npm run typecheck
npm run lint
```

### Test credentials

| Email | Password |
| --- | --- |
| `demo@smartsender.test` | `Password123!` |

Any other password returns a 422 with a field-level error, which is rendered
under the password input.

## Tests

```bash
npm test
```

Three tests, all running against the same MSW handlers the app uses, through the
real HTTP client (`src/api/client.ts`):

1. **The required one** — `src/test/rotate-single-flight.test.ts`: two parallel
   requests both receive a 401, share **one** `/auth/token/rotate`, and both
   retries succeed.
2. The same race when the rotate *fails*: both requests reject and the session is
   terminated exactly once.
3. `src/test/csrf-retry.test.ts`: a 419 drops the cached CSRF token, re-fetches
   `/csrf` and retries the request exactly once.

The session is expired deterministically through a mock test hook
(`__expireSessionNow()`) rather than fake timers or a 30-second sleep.

## Key decisions

### Session rotation is single-flight, with an epoch guard

`refreshSession()` keeps one shared `rotatePromise`, so N requests that hit a 401
at the same time trigger exactly one rotate and then retry.

A bare shared promise is not quite enough, though. A request that left *before* a
rotate can come back with a 401 *after* that rotate already finished, and would
start a second, pointless rotate. So every request captures a `sessionEpoch`
before it is sent; a 401 carrying a stale epoch means "the session was already
refreshed while you were in flight" and is retried without rotating again.

Rotation itself (and the rest of `/auth/*`) runs with `skipAuthRetry`, so a
rotate can never trigger a rotate. Each request is retried **once**: a failed
rotate, or a 401 that survives a successful rotate, ends the local session.

### The API layer knows nothing about React

`src/api/` is plain TypeScript over `fetch`. When the session is unrecoverable it
emits an event (`src/auth/sessionEvents.ts`); `AuthProvider` subscribes, clears
its state and the entire React Query cache, and the router sends the user back to
`/login`. That keeps the retry logic testable without rendering anything — which
is why the required test talks to the client directly.

### Token handling

- `device_session_token` exists only as a local variable inside `login()`,
  between `/auth/login` and `/auth/token/issue`. It is never put into state,
  `localStorage` or the URL.
- Session tokens are never exposed to the client at all: the mock holds them in
  memory, the way an HttpOnly cookie would.
- `localStorage` holds exactly one thing: the 32-hex-character `fingerprint`,
  generated once per device.

### The URL owns the list state

`useListParams` reads `page` and `search` from the query string and is the single
source of truth, so reloads and back/forward restore the exact same view.
Changing the search always resets to page 1. The input keeps its own local state
for responsiveness and is debounced by 300 ms before writing to the URL, so one
settled search term becomes one history entry rather than one per keystroke.

If the URL asks for an out-of-range page, the server clamps it and the URL is
rewritten (with `replace`) to the page that was actually served.

### Validation: the server is the authority

Client-side (zod) validation only catches empty fields. The URL *format* rule
lives solely on the server, so the 422 path is the real, exercised path rather
than something hidden behind a duplicated client rule. Server messages are mapped
onto the matching inputs by `src/lib/applyServerErrors.ts`; any field the form
does not know about is surfaced as a form-level alert instead of being dropped.

### Layout

```
src/
  api/        HTTP client, error types, endpoint functions
  auth/       fingerprint, session events, auth context/provider
  features/   login page, webhooks page + table + edit dialog
  lib/        server-error -> form-field mapping
  mocks/      MSW handlers, in-memory db, mock session
  routes/     router + protected route
  test/       the automated tests
```

## Things worth knowing

- **All state is in memory.** Reloading the page resets the mock, so you have to
  sign in again — this is the intended behaviour per the task's mock rules, not a
  bug. The list parameters in the URL are preserved across that re-login: the
  protected route remembers where you were going and returns you there.
- **The session lasts 30 seconds.** That is deliberately short so the rotate path
  is easy to observe: leave the tab for half a minute, change the page or the
  search, and the network panel shows `401 → /auth/token/rotate → retry`.
- The mock accepts any non-empty `X-Captcha-Token`; no captcha widget is needed.
- `GET /csrf` runs once before the first other API request and the token is
  cached; concurrent first requests share that single call.

## Not done

- No UI tests — the automated tests cover the HTTP/session layer, which is where
  the task's risk actually sits. Rendering is verified manually.
- The design is deliberately plain MUI defaults; the task asks for logic and
  architecture, not visuals.
- Webhook `active` is read-only: the API contract has no endpoint to toggle it.

## Deployment (Vercel)

The app is fully static — the MSW worker *is* the backend — so any static host
works, but a few details matter:

1. `public/mockServiceWorker.js` must be committed. Without it the deployed app
   answers nothing.
2. The worker starts in production too, not just in development, and before the
   first render (`src/main.tsx`). The usual `if (import.meta.env.DEV)` guard from
   the MSW docs would break this app.
3. The service worker must be served from the site root, so `base` stays `/` in
   `vite.config.ts`. This is why Vercel fits better than GitHub Pages under a
   repository subpath.
4. `vercel.json` adds the SPA fallback and explicitly keeps the worker out of it,
   so `/mockServiceWorker.js` is never rewritten to `index.html`.

To deploy: import the repository at vercel.com → New Project. The Vite preset is
detected automatically (`npm run build`, output `dist`). No environment variables
are needed, and HTTPS — required for service workers — is on by default.

After deploying, confirm on the live URL that `/v1/*` requests are served `(from
service worker)`. If an older worker is cached, hard-reload or unregister it in
DevTools → Application → Service Workers.
