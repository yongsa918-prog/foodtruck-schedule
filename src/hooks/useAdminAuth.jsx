import { createContext, useContext, useState } from 'react'

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || ''
const VIEWER_PW = import.meta.env.VITE_VIEWER_PASSWORD || ''

const AuthContext = createContext({
  isAuthenticated: false,
  isAdmin: false,
  authenticate: () => false,
  login: () => false,
  logout: () => {},
  logoutAll: () => {},
})

export function AdminProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  function authenticate(pw) {
    if (ADMIN_PW && pw === ADMIN_PW) {
      setIsAuthenticated(true)
      setIsAdmin(true)
      return 'admin'
    }
    if (VIEWER_PW && pw === VIEWER_PW) {
      setIsAuthenticated(true)
      setIsAdmin(false)
      return 'viewer'
    }
    return false
  }

  function login(pw) {
    if (pw === ADMIN_PW) {
      setIsAdmin(true)
      return true
    }
    return false
  }

  function logout() {
    setIsAdmin(false)
  }

  function logoutAll() {
    setIsAuthenticated(false)
    setIsAdmin(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, authenticate, login, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AuthContext)
}
