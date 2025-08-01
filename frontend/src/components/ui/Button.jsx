// src/components/ui/Button.jsx
import React from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/** Simple inline spinner used during loading */
function Spinner({ size = 16, variant = "light" }) {
    const borderColor = variant === "light" ? "border-white" : "border-gray-600";
    return (
        <span
            aria-hidden="true"
            className={clsx(
                "inline-block rounded-full animate-spin",
                "border-2",
                borderColor,
                "border-t-transparent",
                `w-${size} h-${size}`
            )}
            style={{ width: size, height: size }}
        />
    );
}

export default function Button({
    children,
    variant = "primary", // primary / secondary / outline / destructive / subtle / ghost
    size = "md", // sm / md / lg
    fullWidth = false,
    className = "",
    as: Component = "button",
    loading = false,
    disabled = false,
    leftIcon: LeftIcon = null,
    rightIcon: RightIcon = null,
    "aria-label": ariaLabel,
    pressed, // for toggle semantics
    spinnerPosition = "start", // 'start' | 'overlay'
    ...props
}) {
    const isDisabled = disabled || loading;
    const isToggle = typeof pressed !== "undefined";

    // Base
    const base = "inline-flex items-center justify-center font-semibold rounded-full relative transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
    const sizeMap = {
        sm: "text-sm px-4 py-2 h-9",
        md: "text-base px-6 py-3 h-11",
        lg: "text-lg px-8 py-4 h-12",
    };

    const variantStyles = {
        primary: "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md hover:brightness-105 active:scale-[0.97]",
        secondary: "bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50",
        outline: "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50",
        destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
        subtle: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700",
        ghost: "bg-transparent text-indigo-600 hover:bg-indigo-50",
    };

    const disabledStyles = "opacity-60 pointer-events-none";

    const focusRing = "focus-visible:ring-indigo-400 focus-visible:ring-offset-2";

    // Toggle visual hint if pressed
    const pressedClasses = isToggle
        ? pressed
            ? "ring-2 ring-offset-1 ring-indigo-500"
            : "ring-1 ring-offset-1 ring-gray-300"
        : "";

    return (
        <Component
            aria-label={ariaLabel}
            aria-busy={loading ? "true" : undefined}
            aria-pressed={isToggle ? pressed : undefined}
            disabled={isDisabled}
            className={clsx(
                base,
                sizeMap[size],
                variantStyles[variant] || variantStyles.primary,
                fullWidth && "w-full",
                (isDisabled || loading) && disabledStyles,
                focusRing,
                pressedClasses,
                "relative overflow-hidden",
                className
            )}
            {...(Component === "button" ? { type: props.type || "button" } : {})}
            {...props}
        >
            {/* Overlay spinner (optional) */}
            {loading && spinnerPosition === "overlay" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-full">
                    <Spinner size={16} variant="light" />
                    <span className="sr-only">Loading...</span>
                </div>
            )}

            <div
                className={clsx(
                    "flex items-center gap-2 transition",
                    loading && spinnerPosition === "start" ? "opacity-100" : ""
                )}
                aria-live="polite"
            >
                {loading && spinnerPosition === "start" && (
                    <span className="flex-shrink-0">
                        <Spinner size={16} variant={variant === "primary" ? "light" : "dark"} />
                    </span>
                )}
                {LeftIcon && (
                    <span aria-hidden="true" className="flex-shrink-0">
                        <LeftIcon />
                    </span>
                )}
                <span className={clsx(loading && spinnerPosition === "start" ? "ml-0" : "")}>
                    {children}
                </span>
                {RightIcon && (
                    <span aria-hidden="true" className="flex-shrink-0">
                        <RightIcon />
                    </span>
                )}
            </div>
        </Component>
    );
}

Button.propTypes = {
    children: PropTypes.node,
    variant: PropTypes.oneOf([
        "primary",
        "secondary",
        "outline",
        "destructive",
        "subtle",
        "ghost",
    ]),
    size: PropTypes.oneOf(["sm", "md", "lg"]),
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
};