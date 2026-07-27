import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Self-hosted variable Inter with font-display: swap (avoids render-blocking Google Fonts CSS). */
import '@fontsource-variable/inter/wght.css'
import './index.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
