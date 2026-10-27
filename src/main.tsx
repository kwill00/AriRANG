import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import InstalarApp from './components/InstalarApp'
import PrivacyShell from './components/PrivacyShell'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/social-push-sw.js').catch(() => {
      console.warn('No se pudo preparar la instalación de la app.')
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyShell>
    <InstalarApp />
    <App />
    </PrivacyShell>
  </StrictMode>,
)
