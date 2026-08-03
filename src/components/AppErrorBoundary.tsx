import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorPage } from '../pages/SystemPages'

interface State { hasError: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VitaFit interface error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage onRetry={() => this.setState({ hasError: false })} />
    }
    return this.props.children
  }
}
