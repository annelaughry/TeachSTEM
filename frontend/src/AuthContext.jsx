import { createContext, useContext, useState, useEffect } from 'react'
import api from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const access = localStorage.getItem('access')
    if (access) {
      api.get('auth/me/').then(r => setUser(r.data)).catch(() => {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const { data } = await api.post('auth/login/', { username, password })
    localStorage.setItem('access', data.access)
    localStorage.setItem('refresh', data.refresh)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setUser(null)
  }

  const isTeacher   = user && (user.is_staff || user.is_superuser || user.is_teacher)
  const isAdmin     = user && (user.is_staff || user.is_superuser)
  const isStudent   = user && !isTeacher
  const isTeachSTEM = user && (user.is_staff || user.is_superuser || user.is_teach_stem)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isTeacher, isAdmin, isStudent, isTeachSTEM }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
