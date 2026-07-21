import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // In Part 4, we will hook this up to our telemetry/error monitoring (e.g. Sentry)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full w-full bg-gray-950 p-6 text-center border border-dashed border-red-900 rounded-lg">
          <div className="bg-red-950/30 p-4 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white font-mono mb-2">Something went wrong</h2>
          <p className="text-gray-400 max-w-md mb-6">
            We encountered an unexpected error while rendering this module. Our team has been notified.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-lime-500"
            aria-label="Retry loading this view"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          
          {import.meta.env.DEV && this.state.error && (
            <div className="mt-8 p-4 bg-gray-900 rounded-md text-left w-full max-w-2xl overflow-auto border border-gray-800">
              <p className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                {this.state.error.toString()}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
