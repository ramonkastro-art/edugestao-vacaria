import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

function normalizarErro(error, fallback) {
  return error instanceof Error ? error : new Error(error?.message || fallback)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const profileRequest = useRef(0)

  const fetchProfile = useCallback(async userId => {
    const requestId = ++profileRequest.current
    setProfileLoading(true)
    setProfileError('')
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, nome, role, escola_id')
        .eq('id', userId)
        .maybeSingle()

      if (requestId !== profileRequest.current) return null
      setProfile(data)
      setProfileError(error?.message || (!data ? 'Perfil de acesso não encontrado.' : ''))
      return { data, error }
    } catch (error) {
      if (requestId !== profileRequest.current) return null
      const normalizedError = normalizarErro(error, 'Não foi possível carregar o perfil de acesso.')
      setProfile(null)
      setProfileError(normalizedError.message)
      return { data: null, error: normalizedError }
    } finally {
      if (requestId === profileRequest.current) setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) throw error
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
      } catch (error) {
        if (!mounted) return
        setUser(null)
        setProfile(null)
        setProfileError(normalizarErro(error, 'Não foi possível verificar a sessão.').message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        profileRequest.current += 1
        setProfile(null)
        setProfileError('')
        setProfileLoading(false)
      }
    })

    return () => {
      mounted = false
      profileRequest.current += 1
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  async function signIn(email, password) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return { error }
    } catch (error) {
      return { error: normalizarErro(error, 'Não foi possível entrar agora.') }
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: normalizarErro(error, 'Não foi possível sair agora.') }
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, profileError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
