/**
 * Single source of truth for the API origin, shared by the HTTP client and the
 * MSW handlers so both agree on what a request URL looks like.
 *
 * In the browser the mock lives on the page's own origin. Under Node (tests)
 * there is no `location`, and both `fetch` and MSW need an absolute URL.
 */
export const BASE_URL = typeof location === 'undefined' ? 'http://localhost' : location.origin
