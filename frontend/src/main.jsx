import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const root = document.getElementById('root')

function renderError(error) {
  if (!root) return
  root.innerHTML = `
    <div style="padding:24px;font-family:system-ui,sans-serif;line-height:1.5;">
      <h1 style="color:#b91c1c;">App failed to start</h1>
      <pre style="white-space:pre-wrap;color:#111;">${String(error)}</pre>
      <p>Please check the browser console and your frontend/.env.local file.</p>
    </div>
  `
}

try {
  if (!root) throw new Error('Root element not found')
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (error) {
  console.error(error)
  renderError(error)
}
