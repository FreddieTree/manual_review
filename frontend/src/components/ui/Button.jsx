// src/components/ui/Button.jsx
import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/** Spinner used during loading */
function Spinner({ size = 16, variant = "light" }) {
    const borderClass = variant === "light" ? "border-white" : "border-current";
    return (
        <span
            aria-hidden="true"
            className={clsx(
                "inline-block rounded-full animate-spin border-2 border-t-transparent",
                borderClass
            )}
            style={{ width: size, height: size }}
        />
    );
}

const VARIANT_DEFS = {
    primary: {
        className:
            "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md hover:brightness-[1.05] active:scale-[0.98]",
        fallbackStyle: {
            background: "linear-gradient(90deg,#6366f1,#0ea5e9)",
            color: "#fff",
        },
        spinnerVariant: "light",
    },
    secondary: {
        className:
            "bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-400 dark:border-indigo-400 dark:hover:bg-slate-700",
        fallbackStyle: {
            background: "#ffffff",
            color: "#4f46e5",
            border: "1px solid #6366f1",
        },
        spinnerVariant: "dark",
    },
    outline: {
        className:
            "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5",
        fallbackStyle: {
            background: "transparent",
            color: "#374151",
            border: "1px solid #d1d5db",
        },
        spinnerVariant: "dark",
    },
    destructive: {
        className: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
        fallbackStyle: {
            background: "#dc2626",
            color: "#fff",
        },
        spinnerVariant: "light",
    },
    subtle: {
        className:
            "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-gray-700/70",
        fallbackStyle: {
            background: "#f3f4f6",
            color: "#1f2937",
        },
        spinnerVariant: "dark",
    },
    ghost: {
        className: "bg-transparent text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/5",
        fallbackStyle: {
            background: "transparent",
            color: "#6366f1",
        },
        spinnerVariant: "dark",
    },
};

const SIZE_MAP = {
    xs: "text-xs px-3 py-1 h-8",
    sm: "text-sm px-4 py-2 h-9",
    md: "text-base px-6 py-3 h-11",
    lg: "text-lg px-8 py-4 h-12",
};

function ButtonImpl(
    {
        children,
        variant = "primary",
        size = "md",
        fullWidth = false,
        className = "",
        as: Component = "button",
        loading = false,
        disabled = false,
        leftIcon: LeftIcon = null,
        rightIcon: RightIcon = null,
        "aria-label": ariaLabel,
        pressed,
        spinnerPosition = "start",
        type,
        ...props
    },
    ref
) {
    const isDisabled = disabled || loading;
    const isToggle = typeof pressed !== "undefined";

    const variantDef = VARIANT_DEFS[variant] || VARIANT_DEFS.primary;
    const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

    const classes = clsx(
        "inline-flex items-center justify-center font-semibold rounded-full relative transition-all duration-150 ease-in-out focus-visible:outline-none",
        sizeClass,
        variantDef.className,
        fullWidth && "w-full",
        isDisabled ? "opacity-70 pointer-events-none" : "cursor-pointer",
        isToggle &&
        (pressed
            ? "ring-2 ring-offset-1 ring-indigo-500"
            : "ring-1 ring-offset-1 ring-gray-300 dark:ring-white/15"),
        "overflow-hidden",
        className
    );

    const fallbackStyle = {
        ...variantDef.fallbackStyle,
        ...(isDisabled ? { cursor: "not-allowed" } : {}),
    };

    const buttonProps =
        Component === "button"
            ? { type: type || "button", disabled: isDisabled }
            : { "aria-disabled": isDisabled };

    const spinnerVariant = variantDef.spinnerVariant || "light";

    return (
        <Component
            ref={ref}
            aria-label={ariaLabel}
            aria-busy={loading || undefined}
            aria-pressed={isToggle ? !!pressed : undefined}
            className={classes}
            style={fallbackStyle}
            {...buttonProps}
            {...props}
        >
            {loading && spinnerPosition === "overlay" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10 pointer-events-none">
                    <Spinner size={18} variant={spinnerVariant} />
                    <span className="sr-only">Loading…</span>
                </div>
            )}

            <div
                className={clsx(
                    "flex items-center gap-2 transition flex-1 justify-center",
                    loading && spinnerPosition === "start" ? "opacity-90" : ""
                )}
                aria-live="polite"
            >
                {loading && spinnerPosition === "start" && (
                    <span aria-hidden="true">
                        <Spinner size={16} variant={spinnerVariant} />
                    </span>
                )}
                {LeftIcon && (
                    <span aria-hidden="true" className="flex-shrink-0">
                        <LeftIcon />
                    </span>
                )}
                <span className="truncate">{children}</span>
                {RightIcon && (
                    <span aria-hidden="true" className="flex-shrink-0">
                        <RightIcon />
                    </span>
                )}
            </div>
        </Component>
    );
}

const Button = forwardRef(ButtonImpl);

// propTypes assigned to exported component (not inner render function)
if (process.env.NODE_ENV !== "production") {
    Button.propTypes = {
        children: PropTypes.node,
        variant: PropTypes.oneOf(Object.keys(VARIANT_DEFS)),
        size: PropTypes.oneOf(["xs", "sm", "md", "lg"]),
        fullWidth: PropTypes.bool,
        className: PropTypes.string,
        as: PropTypes.elementType,
        loading: PropTypes.bool,
        disabled: PropTypes.bool,
        leftIcon: PropTypes.elementType,
        rightIcon: PropTypes.elementType,
        "aria-label": PropTypes.string,
        pressed: PropTypes.bool,
        spinnerPosition: PropTypes.oneOf(["start", "overlay"]),
        type: PropTypes.oneOf(["button", "submit", "reset"]),
    };
}

export default Button;