import type { ComponentType } from 'react'
import { AppProvider } from '../src/contexts/AppContext'
import { AuthProvider } from '../src/contexts/AuthContext'
import '../src/styles.css'

interface AppProps {
  Component: ComponentType<Record<string, unknown>>
  pageProps: Record<string, unknown>
}

export default function JhowFitApp({ Component, pageProps }: AppProps) {
  return <AuthProvider><AppProvider><Component {...pageProps} /></AppProvider></AuthProvider>
}
