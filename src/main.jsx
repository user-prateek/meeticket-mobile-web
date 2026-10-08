import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as JotaiProvider } from 'jotai'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { normalizeGluedOlaCallbackUrl } from './lib/olaOauth'

normalizeGluedOlaCallbackUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <JotaiProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </JotaiProvider>
  </StrictMode>,
)
