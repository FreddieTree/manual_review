import React from "react";

/**
 * ErrorBoundary catches rendering errors in its subtree and shows a fallback UI.
 * Props:
 *  - fallback: React node or function (receives error and reset callback)
 *  - onError: optional callback(error, info) for logging
 *  - children: subtree to guard
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        this.setState({ info });
        if (typeof this.props.onError === "function") {
            try {
                this.props.onError(error, info);
            } catch {
                // swallow logging errors
            }
        } else {
            // default console fallback
            // eslint-disable-next-line no-console
            console.error("ErrorBoundary caught error:", error, info);
        }
    }

    reset = () => {
        this.setState({ hasError: false, error: null, info: null });
        // optional: if parent passes a reset handler
        if (this.props.onReset) {
            this.props.onReset();
        }
    };

    render() {
        const { fallback, children } = this.props;
        if (this.state.hasError) {
            if (typeof fallback === "function") {
                return fallback(this.state.error, this.reset);
            }
            return (
                <div role="alert" className="p-6 bg-red-50 border border-red-200 rounded-lg">
                    {fallback || (
                        <div className="flex flex-col gap-2">
                            <div className="text-lg font-bold text-red-700">Something went wrong.</div>
                            <div className="text-sm text-gray-700">
                                Please refresh the page or try again later.
                            </div>
                            <button
                                onClick={this.reset}
                                className="mt-2 inline-flex px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:brightness-105 transition"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </div>
            );
        }
        return children;
    }
}