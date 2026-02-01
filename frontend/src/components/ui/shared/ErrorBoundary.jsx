import { Component } from "react";

export function ErrorFallback({ error, resetError, sectionName }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <div className="text-red-400 text-sm font-medium mb-2">
        {sectionName ? `Error loading ${sectionName}` : "Something went wrong"}
      </div>
      <div className="text-[#78716C] text-xs mb-4">
        {error?.message || "An unexpected error occurred"}
      </div>
      {resetError && (
        <button
          onClick={resetError}
          className="px-4 py-2 text-xs rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function SectionLoading({ sectionName }) {
  return (
    <div className="rounded-xl border border-[#1A1814] bg-[#0F0F0D] p-6 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 bg-[#1A1814] rounded-full"></div>
        <div className="h-3 w-32 bg-[#1A1814] rounded"></div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-[#1A1814] rounded w-3/4"></div>
        <div className="h-4 bg-[#1A1814] rounded w-1/2"></div>
        <div className="h-20 bg-[#1A1814] rounded"></div>
      </div>
      {sectionName && (
        <div className="text-[#78716C] text-xs text-center mt-4">
          Loading {sectionName}...
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {

      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback({
            error: this.state.error,
            resetError: this.resetError,
          });
        }
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
          sectionName={this.props.sectionName}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
