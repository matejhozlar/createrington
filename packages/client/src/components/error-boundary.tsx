import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useLocation } from "react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorFallback } from "./error-fallback";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: unknown;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) console.error("[ErrorBoundary]", error, errorInfo);
  }

  componentDidUpdate(
    prevProps: ErrorBoundaryProps,
    prevState: ErrorBoundaryState,
  ) {
    if (
      this.state.hasError &&
      prevState.hasError &&
      !Object.is(prevProps.resetKey, this.props.resetKey)
    ) {
      this.handleReset();
    }
  }

  private handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;

      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary resetKey={pathname} onReset={reset}>
      {children}
    </ErrorBoundary>
  );
}
