import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminProvider } from './hooks/useAdminAuth'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminProvider>
      <App />
    </AdminProvider>
  </StrictMode>,
)
