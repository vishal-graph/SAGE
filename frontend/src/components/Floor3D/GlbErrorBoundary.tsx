import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback: ReactNode }
type State = { err: boolean }

export class GlbErrorBoundary extends Component<Props, State> {
  state: State = { err: false }

  static getDerivedStateFromError(): State {
    return { err: true }
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    console.warn('Kenney GLB failed:', e.message, info.componentStack)
  }

  render() {
    if (this.state.err) return this.props.fallback
    return this.props.children
  }
}
