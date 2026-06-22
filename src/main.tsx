import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  let reloadRequested = false

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (
      !reloadRequested &&
      (event.data?.type === 'PAGE_RELOAD_REQUIRED' ||
        event.data?.type === 'RELEASE_HARD_RELOAD_REQUIRED')
    ) {
      reloadRequested = true
      console.log(`Service worker requested page reload: ${event.data.type}`)
      window.location.reload()
    }
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}
