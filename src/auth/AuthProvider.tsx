import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchMe, login, logout } from '../api/auth'
import { markSessionEnded } from '../api/client'
import type { Me } from '../api/types'
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext'
import { onSessionExpired } from './sessionEvents'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<Me | null>(null)
  const [status, setStatus] = useState<AuthStatus>('anonymous')

  /** Drops every trace of the user: local state plus all cached user data. */
  const clearLocalSession = useCallback(() => {
    markSessionEnded()
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

  // The API layer reports an unrecoverable 401 (failed rotate or a repeated 401).
  useEffect(() => onSessionExpired(clearLocalSession), [clearLocalSession])

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (credentials) => {
      setStatus('authenticating')
      try {
        await login(credentials)
        const me = await fetchMe()
        setUser(me)
        setStatus('authenticated')
      } catch (error) {
        clearLocalSession()
        throw error
      }
    },
    [clearLocalSession],
  )

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    try {
      await logout()
    } finally {
      clearLocalSession()
    }
  }, [clearLocalSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, signIn, signOut }),
    [user, status, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
