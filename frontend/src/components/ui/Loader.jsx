import React, { forwardRef, useEffect, useState } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Accessible loader / spinner with delay, skeleton fallback, reduced-motion support, and dark-mode awareness.
 */
function LoaderImpl(
    {
        size = "md", // 'sm' | 'md' | 'lg' | number(px)
        label = "Loading...",
        variant = "primary", // 'primary' | 'neutral'
        layout = "inline", // 'inline' | 'block'
        delayMs = 150, // avoid flash for very fast loads
        skeleton = false, // show skeleton rectangle instead of spinner
        "aria-label": ariaLabel,
        className = "",
        ...props
    },
    ref
) {
    const [show, setShow] = useState(delayMs === 0);

    useEffect(() => {
        if (delayMs === 0) {
            setShow(true);
            return;
        }
        const t = setTimeout(() => setShow(true), delayMs);
        return () => clearTimeout(t);
    }, [delayMs]);

    const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Normalize numeric size
    const numericSize =
        typeof size === "number" ? size : size === "sm" ? 20 : size === "lg" ? 48 : 36;
    const strokeWidth = Math.max(2, Math.round(numericSize * 0.11));

    // Colors (light/dark aware via classes & inline SVG stroke)
    const colorMap = {
        primary: {
            spinner: "#2B5DD7",
            track: "#e2e8f0",
            text: "text-gray-700 dark:text-gray-300",
        },
        neutral: {
            spinner: "#6b7280",
            track: "#f1f5f9",
            text: "text-gray-500 dark:text-gray-400",
        },
    };
    const colors = colorMap[variant] || colorMap.primary;

    if (!show) return null;

    const isBlock = layout === "block";

    return (
        <div
            ref={ref}
            role="status"
            aria-label={ariaLabel || label}
            aria-busy="true"
            className={clsx(
                "select-none",
                isBlock ? "flex flex-col items-center" : "inline-flex items-center",
                className
            )}
            {...props}
        >
            {skeleton ? (
                // Skeleton placeholder（用内联 style 避免动态 Tailwind 类不生效）
                <div
                    aria-hidden="true"
                    className={clsx("rounded-md bg-gray-200 dark:bg-slate-700 animate-pulse")}
                    style={{
                        height: typeof size === "number" ? `${numericSize}px` : size === "sm" ? "16px" : size === "lg" ? "24px" : "20px",
                        width:
                            typeof size === "number"
                                ? `${numericSize * 4}px`
                                : size === "sm"
                                    ? "80px"
                                    : size === "lg"
                                        ? "112px"
                                        : "96px",
                        transition: "background-color .2s ease",
                    }}
                />
            ) : (
                <>
                    <div
                        aria-hidden="true"
                        className="relative flex-shrink-0"
                        style={{ width: numericSize, height: numericSize }}
                    >
                        {/* Spinner */}
                        <svg
                            width={numericSize}
                            height={numericSize}
                            viewBox="0 0 50 50"
                            className={clsx("block", prefersReduced ? "opacity-75" : "animate-spin")}
                            aria-hidden="true"
                        >
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                fill="none"
                                stroke={colors.track}
                                strokeWidth={strokeWidth}
                                className="transition-colors"
                            />
                            <path
                                fill="none"
                                stroke={colors.spinner}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                d="M25 5a20 20 0 0 1 0 40"
                            />
                        </svg>
                        {/* Soft depth shadow */}
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{ boxShadow: "0 8px 24px -4px rgba(43,93,215,0.18)" }}
                        />
                    </div>
                    {label && (
                        <div
                            className={clsx(
                                "ml-3 text-sm transition-opacity duration-200",
                                colors.text,
                                isBlock ? "mt-2 ml-0" : ""
                            )}
                            aria-live="polite"
                        >
                            {label}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

if (process.env.NODE_ENV !== "production") {
    LoaderImpl.propTypes = {
        size: PropTypes.oneOfType([PropTypes.oneOf(["sm", "md", "lg"]), PropTypes.number]),
        label: PropTypes.string,
        variant: PropTypes.oneOf(["primary", "neutral"]),
        layout: PropTypes.oneOf(["inline", "block"]),
        delayMs: PropTypes.number,
        skeleton: PropTypes.bool,
        "aria-label": PropTypes.string,
        className: PropTypes.string,
    };
}

const Loader = forwardRef(LoaderImpl);
export default Loader;