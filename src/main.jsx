import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installErrorLog } from './lib/errorLog.js'
import './index.css'
import App from './App.jsx'

installErrorLog()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
