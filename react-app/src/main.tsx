import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { UserProvider } from './contexts/UserContext'
import { CartProvider } from './contexts/CartContext'
import { PlanProvider } from './contexts/PlanContext'
import { syncServerTimeOffset } from './lib/timeSync'

// 1. Fetch real Indian Standard Time from the backend
// 2. Intercept and correct the browser's global Date object
// 3. Fully render the React application
syncServerTimeOffset()
  .catch((err) => console.warn('[main] Time sync failed, proceeding with local time:', err))
  .then(() => {
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
  })
