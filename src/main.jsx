import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initBackendSync } from './services/backendSync'

// The hotel's data is downloaded from the backend (MongoDB) BEFORE the screens start,
// because the screens read it from the in-memory data store (no localStorage, no mock data).
const root = createRoot(document.getElementById('root'))

function showConnectionError(message) {
  root.render(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, Segoe UI, Roboto, sans-serif', color: '#0f172a', background: '#f8fafc' }}>
      <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Cannot reach the server</div>
        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
          {message || 'The hotel data could not be loaded. Please check your connection and try again.'}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    </div>,
  )
}

async function start() {
  try {
    await initBackendSync()
  } catch (err) {
    console.error('Backend sync init failed:', err)
    showConnectionError(err && err.message)
    return
  }
  const { default: App } = await import('./App.jsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()
