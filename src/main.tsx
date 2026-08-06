import React from 'react'
import ReactDOM from 'react-dom/client'
import './privacy/mediaAccessGuard'
import App from './App'
import { AppProvider } from './contexts/AppContext'
import { AuthProvider } from './contexts/AuthContext'
import './styles.css'
import './training.css'
import './pwa/registerServiceWorker'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider><AppProvider><App /></AppProvider></AuthProvider></React.StrictMode>,
)
