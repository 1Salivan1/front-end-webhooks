const STORAGE_KEY = 'ss.fingerprint'
const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/

function generate(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readStored(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== null && FINGERPRINT_PATTERN.test(stored) ? stored : null
  } catch {
    return null
  }
}

let cached: string | null = null

/**
 * Stable 32 hex character device id: generated once, then reused from
 * localStorage. Unlike the session tokens this is not a secret.
 */
export function getFingerprint(): string {
  if (cached !== null) return cached

  const stored = readStored()
  if (stored !== null) {
    cached = stored
    return stored
  }

  const fingerprint = generate()
  try {
    localStorage.setItem(STORAGE_KEY, fingerprint)
  } catch {
    // Private mode / disabled storage: fall back to a per-tab fingerprint.
  }
  cached = fingerprint
  return fingerprint
}
