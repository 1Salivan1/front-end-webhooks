import { createContext } from 'react'
import type { Me } from '../api/types'

export type AuthStatus = 'anonymous' | 'authenticating' | 'authenticated'

export interface AuthContextValue {
  user: Me | null
  status: AuthStatus
  signIn: (credentials: { email: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
