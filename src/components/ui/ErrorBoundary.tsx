import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

/**
 * Shows `fallback` instead of a blank page when something below it throws while rendering.
 * There's no reset method: give it a new `key` to try again with fresh children.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('The board crashed', error, info.componentStack)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
