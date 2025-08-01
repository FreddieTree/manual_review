// src/components/ErrorBoundary.jsx
import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * ErrorBoundary with enhanced UX:
 *  - automatic reset when resetKey changes
 *  - optional external error reporting (reportError)
 *  - friendly fallback UI with error ID, toggleable stack trace (dev), and retry
 *  - separation of onError (local) vs reportError (remote)
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            info: null,
            errorId: null,
            showingDetails: false,
            lastResetKey: props.resetKey,
            retrying: false,
        };
        this.retryTimeout = null;
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        const errorId = this._generateErrorId();
        this.setState({ error, info, errorId });

        // local callback
        if (typeof this.props.onError === "function") {
            try {
                this.props.onError(error, info, errorId);
            } catch {
                // swallow
            }
        }

        // remote/reporting (guarded)
        if (typeof this.props.reportError === "function") {
            try {
                this.props.reportError({ error, info, errorId });
            } catch {
                // swallow
            }
        } else if (this.props.logToConsole !== false) {
            // fallback logging in dev
            // eslint-disable-next-line no-console
            console.error(`[${errorId}] ErrorBoundary caught error:`, error, info);
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.resetKey !== undefined && this.props.resetKey !== prevProps.resetKey) {
            // automatic reset when key changes
            this.reset();
        }
    }

    componentWillUnmount() {
        if (this.retryTimeout) clearTimeout(this.retryTimeout);
    }

    _generateErrorId() {
        // short human-friendly id: timestamp + random
        return (
            Date.now().toString(36).slice(-5) +
            "-" +
            Math.random().toString(36).substring(2, 6)
        ).toUpperCase();
    }

    reset = () => {
        this.setState({
            hasError: false,
            error: null,
            info: null,
            errorId: null,
            showingDetails: false,
            retrying: false,
        });
        if (typeof this.props.onReset === "function") {
            try {
                this.props.onReset();
            } catch {
                // ignore
            }
        }
    };

    handleRetry = () => {
        if (this.state.retrying) return;
        this.setState({ retrying: true }, () => {
            // optional delay to avoid rapid spam
            const delay = this.props.retryDelay || 300;
            this.retryTimeout = setTimeout(() => {
                this.reset();
            }, delay);
        });
    };

    toggleDetails = () => {
        this.setState((s) => ({ showingDetails: !s.showingDetails }));
    };

    renderFallback = () => {
        const { fallback } = this.props;
        const { error, info, errorId, showingDetails, retrying } = this.state;

        // If fallback is function, call with context
        if (typeof fallback === "function") {
            return fallback(
                error,
                {
                    reset: this.reset,
                    retry: this.handleRetry,
                    errorId,
                },
                info
            );
        }

        // Default UI
        return (
            <div
                role="alert"
                aria-live="polite"
                className="max-w-md mx-auto bg-white dark:bg-[#1f2937] border border-red-200 dark:border-red-700 rounded-2xl shadow-lg p-6 flex flex-col gap-4"
            >
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 flex items-center justify-center bg-red-100 dark:bg-red-800 rounded-full">
                            <svg
                                aria-hidden="true"
                                className="w-6 h-6 text-red-600 dark:text-red-300"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 8v4m0 4h.01M4.93 4.93l14.14 14.14"
                                />
                            </svg>
                        </div>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            We couldn’t load this section. You can retry or refresh the page.
                        </p>
                        {errorId && (
                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                Error ID: <span className="font-mono">{errorId}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 flex-wrap justify-end">
                    <button
                        onClick={this.handleRetry}
                        disabled={retrying}
                        className={clsx(
                            "inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium transition",
                            retrying
                                ? "bg-gray-200 text-gray-600 cursor-not-allowed"
                                : "bg-indigo-600 text-white hover:brightness-105"
                        )}
                    >
                        {retrying ? "Retrying…" : "Retry"}
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-4 py-2 rounded-full font-medium border border-gray-300 hover:bg-gray-50 transition text-sm"
                    >
                        Refresh page
                    </button>
                    <button
                        onClick={this.toggleDetails}
                        className="text-xs text-indigo-600 hover:underline"
                        aria-expanded={showingDetails}
                    >
                        {showingDetails ? "Hide details" : "Show details"}
                    </button>
                </div>

                {showingDetails && error && (
                    <div className="mt-2 bg-gray-50 dark:bg-[#111827] p-3 rounded-md overflow-auto text-[11px]">
                        <div className="font-mono break-all text-red-800 dark:text-red-300 mb-2">
                            {error.toString()}
                        </div>
                        {info?.componentStack && (
                            <pre className="whitespace-pre-wrap text-[10px] text-gray-700 dark:text-gray-400">
                                {info.componentStack}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        );
    };

    render() {
        if (this.state.hasError) {
            return this.renderFallback();
        }
        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    onError: PropTypes.func, // local callback
    reportError: PropTypes.func, // remote/error reporting sink
    onReset: PropTypes.func,
    resetKey: PropTypes.any,
    retryDelay: PropTypes.number,
    logToConsole: PropTypes.bool,
    children: PropTypes.node,
};

ErrorBoundary.defaultProps = {
    fallback: null,
    onError: null,
    reportError: null,
    onReset: null,
    resetKey: undefined,
    retryDelay: 300,
    logToConsole: true,
};