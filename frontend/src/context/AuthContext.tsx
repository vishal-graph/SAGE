import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearStoredAuthToken, getJson, getStoredAuthToken, postJson, setStoredAuthToken } from '../api/client'
import type { AuthResponse, UserSummary } from '../types/auth'

interface AuthContextValue {
  user: UserSummary | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signUp: (
    name: string,
    email: string,
    phone: string,
    password: string,
    role: 'vendor' | 'customer' | 'supplier',
  ) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function persistAuth(payload: AuthResponse, setUser: (user: UserSummary | null) => void) {
  setStoredAuthToken(payload.token)
  setUser(payload.user)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getStoredAuthToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await getJson<{ user: UserSummary }>('/auth/me')
      setUser(res.user)
    } catch {
      clearStoredAuthToken()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const signIn = useCallback(async (identifier: string, password: string) => {
    const payload = await postJson<AuthResponse>('/auth/sign-in', { identifier, password })
    persistAuth(payload, setUser)
  }, [])

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      phone: string,
      password: string,
      role: 'vendor' | 'customer' | 'supplier',
    ) => {
      const payload = await postJson<AuthResponse>('/auth/sign-up', { name, email, phone, password, role })
    persistAuth(payload, setUser)
    },
    [],
  )

  const signOut = useCallback(async () => {
    try {
      await postJson('/auth/sign-out', {})
    } catch {
      // Ignore server-side sign-out errors and clear local session anyway.
    } finally {
      clearStoredAuthToken()
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [user, isLoading, signIn, signUp, signOut, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
