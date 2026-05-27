import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminProvider } from './hooks/useAdminAuth'
import LoginGate from './components/LoginGate'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminProvider>
      <LoginGate>
        <App />
      </LoginGate>
    </AdminProvider>
  </StrictMode>,
)
