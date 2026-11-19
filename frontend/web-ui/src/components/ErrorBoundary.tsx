import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  resetKey?: string; // when this changes (for example the route), the boundary recovers
}
interface State {
  failed: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Goes to the browser console only. Never show stack traces to users.
    console.error("UI error:", error.message, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl">Something went wrong</h1>
        <p className="mt-2 text-muted">
          This page hit an unexpected error. Your cart and orders are safe.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn-primary" onClick={() => window.location.reload()}>Reload page</button>
          <a href="/" className="btn-outline">Go to home</a>
        </div>
      </div>
    );
  }
}
