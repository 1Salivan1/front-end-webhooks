/**
 * Minimal pub/sub so the API layer can report "the session is gone" without
 * importing React or the router.
 */

type Listener = () => void

const listeners = new Set<Listener>()

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitSessionExpired(): void {
  for (const listener of [...listeners]) listener()
}
