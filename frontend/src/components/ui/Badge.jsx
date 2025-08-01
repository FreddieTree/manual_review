// src/components/ui/Badge.jsx
import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Enhanced Badge / Pill component.
 * Supports variants, colors, sizes, icons, closeable, loading, toggle, dark mode, and accessibility.
 */
export default function Badge({
    children,
    variant = "solid", // solid / subtle / outline
    color = "primary", // primary / success / warning / danger / gray / neutral
    size = "md", // sm / md / lg
    className = "",
    title = "",
    "aria-label": ariaLabel,
    as: Component = "span",
    clickable = false,
    onClick,
    closeable = false,
    onClose,
    loading = false,
    disabled = false,
    startIcon = null,
    endIcon = null,
    pressed, // for toggle semantics
    ...rest
}) {
    const base = "inline-flex items-center select-none rounded-full font-semibold leading-none transition flex-shrink-0";
    const sizeMap = {
        sm: "text-xs px-2 py-1 gap-1",
        md: "text-sm px-2.5 py-1.5 gap-1.5",
        lg: "text-base px-3 py-2 gap-2",
    };

    const colorVariants = {
        primary: {
            solid: "bg-gradient-to-r from-indigo-600 to-sky-500 text-white",
            subtle: "bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200",
            outline: "border border-indigo-600 text-indigo-600 bg-transparent",
        },
        success: {
            solid: "bg-emerald-600 text-white",
            subtle: "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200",
            outline: "border border-emerald-600 text-emerald-600 bg-transparent",
        },
        warning: {
            solid: "bg-yellow-500 text-white",
            subtle: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
            outline: "border border-yellow-500 text-yellow-600 bg-transparent",
        },
        danger: {
            solid: "bg-red-600 text-white",
            subtle: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
            outline: "border border-red-600 text-red-600 bg-transparent",
        },
        gray: {
            solid: "bg-gray-800 dark:bg-gray-700 text-white",
            subtle: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
            outline: "border border-gray-400 text-gray-700 dark:text-gray-300 bg-transparent",
        },
        neutral: {
            solid: "bg-slate-600 text-white",
            subtle: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
            outline: "border border-slate-600 text-slate-600 bg-transparent",
        },
    };

    const variantClasses =
        (colorVariants[color] || colorVariants.primary)[variant] || colorVariants.primary.solid;

    const interactive =
        clickable && !disabled && !loading
            ? "cursor-pointer hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400"
            : "";

    const disabledClasses = disabled
        ? "opacity-60 pointer-events-none"
        : "";

    const toggleAria = typeof pressed !== "undefined" ? { "aria-pressed": pressed } : {};

    return (
        <Component
            role="status"
            aria-label={ariaLabel}
            title={title || (typeof children === "string" ? children : undefined)}
            onClick={!disabled && !loading && clickable ? onClick : undefined}
            tabIndex={clickable && !disabled ? 0 : undefined}
            className={clsx(
                base,
                sizeMap[size],
                variantClasses,
                interactive,
                disabledClasses,
                "relative overflow-hidden",
                className
            )}
            {...toggleAria}
            {...rest}
        >
            {loading ? (
                <div className="flex items-center gap-1">
                    <span
                        aria-hidden="true"
                        className="w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin"
                    />
                    <span className="sr-only">Loading</span>
                </div>
            ) : (
                <>
                    {startIcon && (
                        <span className="flex-shrink-0 -ml-0.5">
                            {startIcon}
                        </span>
                    )}
                    <span className="truncate">{children}</span>
                    {endIcon && (
                        <span className="flex-shrink-0 -mr-0.5">
                            {endIcon}
                        </span>
                    )}
                    {closeable && !disabled && (
                        <button
                            type="button"
                            aria-label="Close badge"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose && onClose(e);
                            }}
                            className="ml-1 flex items-center justify-center rounded-full p-1 transition hover:bg-white/20 dark:hover:bg-gray-600"
                        >
                            <svg
                                aria-hidden="true"
                                className="w-3 h-3"
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                </>
            )}
        </Component>
    );
}

Badge.propTypes = {
    children: PropTypes.node,
    variant: PropTypes.oneOf(["solid", "subtle", "outline"]),
    color: PropTypes.oneOf([
        "primary",
        "success",
        "warning",
        "danger",
        "gray",
        "neutral",
    ]),
    size: PropTypes.oneOf(["sm", "md", "lg"]),
    className: PropTypes.string,
    title: PropTypes.string,
    "aria-label": PropTypes.string,
    as: PropTypes.elementType,
    clickable: PropTypes.bool,
    onClick: PropTypes.func,
    closeable: PropTypes.bool,
    onClose: PropTypes.func,
    loading: PropTypes.bool,
    disabled: PropTypes.bool,
    startIcon: PropTypes.node,
    endIcon: PropTypes.node,
    pressed: PropTypes.bool,
};