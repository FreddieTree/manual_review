import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";

/** Inline spinner used during loading (no dynamic Tailwind class reliance) */
function Spinner({ size = 16, variant = "light" }) {
    const borderClass = variant === "light" ? "border-white" : "border-gray-500";
    return (
        <span
            aria-hidden="true"
            className={clsx(
                "inline-block rounded-full animate-spin",
                "border-2",
                borderClass,
                "border-t-transparent"
            )}
            style={{ width: size, height: size }}
        />
    );
}

function ButtonImpl(
    {
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
        type,
        ...props
    },
    ref
) {
    const isDisabled = disabled || loading;
    const isToggle = typeof pressed !== "undefined";

    const base =
        "inline-flex items-center justify-center font-semibold rounded-full relative transition-all duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
    const sizeMap = {
        sm: "text-sm px-4 py-2 h-9",
        md: "text-base px-6 py-3 h-11",
        lg: "text-lg px-8 py-4 h-12",
    };

    const variantStyles = {
        primary:
            "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md hover:brightness-[1.05] active:scale-[0.98]",
        secondary:
            "bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50",
        outline:
            "bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5",
        destructive:
            "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
        subtle:
            "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200/80 dark:hover:bg-gray-700/70",
        ghost:
            "bg-transparent text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white/5",
    };

    const disabledStyles = "opacity-60 pointer-events-none";
    const focusRing = "focus-visible:ring-indigo-400 focus-visible:ring-offset-2";

    const pressedClasses =
        isToggle
            ? pressed
                ? "ring-2 ring-offset-1 ring-indigo-500"
                : "ring-1 ring-offset-1 ring-gray-300 dark:ring-white/15"
            : "";

    const buttonProps =
        Component === "button"
            ? { type: type || "button", disabled: isDisabled }
            : {};

    return (
        <Component
            ref={ref}
            aria-label={ariaLabel}
            aria-busy={loading || undefined}
            aria-pressed={isToggle ? !!pressed : undefined}
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
            {...buttonProps}
            {...props}
        >
            {/* Overlay spinner (optional) */}
            {loading && spinnerPosition === "overlay" && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/10">
                    <Spinner size={16} variant="light" />
                    <span className="sr-only">Loading…</span>
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
                <span>{children}</span>
                {RightIcon && (
                    <span aria-hidden="true" className="flex-shrink-0">
                        <RightIcon />
                    </span>
                )}
            </div>
        </Component>
    );
}

if (process.env.NODE_ENV !== "production") {
    ButtonImpl.propTypes = {
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
        type: PropTypes.oneOf(["button", "submit", "reset"]),
    };
}

const Button = forwardRef(ButtonImpl);
export default Button;