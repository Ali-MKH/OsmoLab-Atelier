import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface TabErrorBoundaryProps {
  activeSection: string;
  sectionTitle?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
  retryCount: number;
}

export class TabErrorBoundary extends React.Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: unknown): Partial<TabErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : 'Unexpected data rendering error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[TabErrorBoundary] Caught runtime error in section "${this.props.activeSection}":`,
      error,
      errorInfo
    );
  }

  componentDidUpdate(prevProps: TabErrorBoundaryProps): void {
    if (prevProps.activeSection !== this.props.activeSection && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  handleRetry = (): void => {
    try {
      this.props.onRetry?.();
    } catch (retryError) {
      console.warn('[TabErrorBoundary] onRetry callback warning:', retryError);
    }
    this.setState((prev) => ({
      hasError: false,
      errorMessage: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          data-testid="tab-error-boundary"
          className="rounded-xl bg-[#111621] border border-amber-500/40 p-6 space-y-4 text-xs"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white">
                {this.props.sectionTitle
                  ? `Unable to render ${this.props.sectionTitle}`
                  : 'This workspace panel encountered a temporary display issue'}
              </h2>
              <p className="text-slate-300 leading-relaxed">
                Your formulas, accords, and workbench materials are safe. Click Retry below to restore and re-render this view.
              </p>
              {this.state.errorMessage && (
                <p className="font-mono-tabular text-[11px] text-slate-400 pt-1">
                  Detail: {this.state.errorMessage}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="tab-error-retry-btn"
              aria-label="Retry"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={`${this.props.activeSection}-${this.state.retryCount}`}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

