import React from 'react'
import ReactDOM from 'react-dom/client'
import './privacy/mediaAccessGuard'
import './styles.css'
import './training.css'
import './referenceTheme.css'
import App from './App'
import { AppProvider } from './contexts/AppContext'
import { AuthProvider } from './contexts/AuthContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthProvider><AppProvider><App /></AppProvider></AuthProvider></React.StrictMode>,
)
