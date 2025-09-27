/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { isDemoMode } from '../lib/env'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const demoMode = isDemoMode

function createDemoUser(email = 'demo@dayroll.test'): User {
  const timestamp = new Date().toISOString()
  return {
    id: 'demo-user',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { demo: true, email },
    aud: 'authenticated',
    email,
    phone: '',
    created_at: timestamp,
    confirmed_at: timestamp,
    email_confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    updated_at: timestamp,
    role: 'authenticated',
    identities: [],
    factors: [],
  }
}

function createDemoSession(user: User): Session {
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    expires_in: 60 * 60,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    token_type: 'bearer',
    provider_token: null,
    provider_refresh_token: null,
    user,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (demoMode) {
      const demoUser = createDemoUser()
      setUser(demoUser)
      setSession(createDemoSession(demoUser))
      setLoading(false)
      return
    }

    let mounted = true

    const init = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setLoading(false)
    }

    void init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    if (demoMode) {
      const demoUser = createDemoUser(email)
      setUser(demoUser)
      setSession(createDemoSession(demoUser))
      setLoading(false)
      return {}
    }

    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    })
    if (error) {
      return { error: error.message }
    }
    return {}
  }, [])

  const signOut = useCallback(async () => {
    if (demoMode) {
      setUser(null)
      setSession(null)
      return
    }
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      signInWithEmail,
      signOut,
    }),
    [user, session, loading, signInWithEmail, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
