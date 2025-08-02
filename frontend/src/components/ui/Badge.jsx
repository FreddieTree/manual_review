import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/**
 * Enhanced Badge / Pill component.
 * - variants: solid / subtle / outline
 * - colors: primary / success / warning / danger / gray / neutral
 * - sizes: sm / md / lg
 * - supports: icons, closeable, clickable, loading, toggle(pressed), dark mode, a11y
 */
function BadgeImpl(
    {
        children,
        variant = "solid",
        color = "primary",
        size = "md",
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
    },
    ref
) {
    const base =
        "inline-flex items-center select-none rounded-full font-semibold leading-none transition flex-shrink-0";
    const sizeMap = {
        sm: "text-xs px-2 py-1 gap-1",
        md: "text-sm px-2.5 py-1.5 gap-1.5",
        lg: "text-base px-3 py-2 gap-2",
    };

    const colorVariants = {
        primary: {
            solid: "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm",
            subtle:
                "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border border-indigo-100/70 dark:border-white/10",
            outline: "border border-indigo-500 text-indigo-600 bg-transparent",
        },
        success: {
            solid: "bg-emerald-600 text-white shadow-sm",
            subtle:
                "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200/70 dark:border-white/10",
            outline: "border border-emerald-600 text-emerald-700 bg-transparent",
        },
        warning: {
            solid: "bg-yellow-500 text-white shadow-sm",
            subtle:
                "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border border-yellow-200/70 dark:border-white/10",
            outline: "border border-yellow-500 text-yellow-700 bg-transparent",
        },
        danger: {
            solid: "bg-red-600 text-white shadow-sm",
            subtle:
                "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border border-red-200/70 dark:border-white/10",
            outline: "border border-red-600 text-red-700 bg-transparent",
        },
        gray: {
            solid: "bg-gray-800 dark:bg-gray-700 text-white shadow-sm",
            subtle:
                "bg-gray-100 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 border border-gray-200/70 dark:border-white/10",
            outline: "border border-gray-400 text-gray-700 dark:text-gray-200 bg-transparent",
        },
        neutral: {
            solid: "bg-slate-600 text-white shadow-sm",
            subtle:
                "bg-slate-100 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-white/10",
            outline: "border border-slate-600 text-slate-700 dark:text-slate-200 bg-transparent",
        },
    };

    const variantClasses =
        (colorVariants[color] || colorVariants.primary)[variant] ||
        colorVariants.primary.solid;

    const interactive =
        clickable && !disabled && !loading
            ? "cursor-pointer hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-400"
            : "";

    const disabledClasses = disabled ? "opacity-60 pointer-events-none" : "";

    const toggleAria =
        typeof pressed !== "undefined" ? { "aria-pressed": !!pressed } : {};

    const computedTitle =
        title || (typeof children === "string" ? children : undefined);

    return (
        <Component
            ref={ref}
            aria-label={ariaLabel}
            title={computedTitle}
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
                <span className="inline-flex items-center gap-1">
                    <span
                        aria-hidden="true"
                        className="w-4 h-4 border-2 border-t-white border-white/40 rounded-full animate-spin"
                    />
                    <span className="sr-only">Loading</span>
                </span>
            ) : (
                <>
                    {startIcon && <span className="flex-shrink-0 -ml-0.5">{startIcon}</span>}
                    <span className="truncate">{children}</span>
                    {endIcon && <span className="flex-shrink-0 -mr-0.5">{endIcon}</span>}
                    {closeable && !disabled && (
                        <button
                            type="button"
                            aria-label="Close badge"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose && onClose(e);
                            }}
                            className="ml-1 flex items-center justify-center rounded-full p-1 transition hover:bg-white/25 dark:hover:bg-white/10"
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

if (process.env.NODE_ENV !== "production") {
    BadgeImpl.propTypes = {
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
}

const Badge = forwardRef(BadgeImpl);
export default Badge;