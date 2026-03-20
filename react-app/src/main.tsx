import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { UserProvider } from './contexts/UserContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <AppSettingsProvider>
        <App />
      </AppSettingsProvider>
    </UserProvider>
  </StrictMode>,
)
