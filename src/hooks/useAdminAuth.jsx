import { createContext, useContext, useState } from 'react'

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD || ''

const AdminContext = createContext({ isAdmin: false, login: () => false, logout: () => {} })

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false)

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

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  return useContext(AdminContext)
}
