import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { UserProvider } from './contexts/UserContext'
import { CartProvider } from './contexts/CartContext'
import { PlanProvider } from './contexts/PlanContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <AppSettingsProvider>
        <CartProvider>
          <PlanProvider>
            <App />
          </PlanProvider>
        </CartProvider>
      </AppSettingsProvider>
    </UserProvider>
  </StrictMode>,
)
