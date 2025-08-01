// src/components/ui/Select.jsx
import React, { forwardRef } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import Loader from "./Loader";

/**
 * Apple-like upgraded Select component.
 * Features: error/success/disabled states, loading indicator, accessible labels, smooth focus, dark-mode friendly.
 */
const sizeMap = {
    sm: "text-sm h-9",
    md: "text-base h-11",
    lg: "text-lg h-12",
};

const Select = forwardRef(function Select(
    {
        className = "",
        variant = "default", // default / error / success
        size = "md", // sm / md / lg
        id,
        name,
        disabled = false,
        children,
        errorMessage,
        helpText,
        loading = false,
        prefix = null,
        suffix = null,
        placeholder = "",
        onClear,
        clearable = false,
        value,
        "aria-label": ariaLabel,
        ...props
    },
    ref
) {
    const isInvalid = variant === "error";
    const describedByIds = [];
    if (errorMessage) describedByIds.push(id ? `${id}-error` : undefined);
    if (helpText) describedByIds.push(id ? `${id}-help` : undefined);

    // Color/shadow logic (light + dark)
    const baseBg = disabled ? "bg-gray-100 dark:bg-slate-800" : "bg-white dark:bg-slate-900";
    const borderColor =
        variant === "error"
            ? "border-red-400 focus:ring-red-300"
            : variant === "success"
                ? "border-emerald-400 focus:ring-emerald-300"
                : "border border-gray-200 dark:border-slate-700 focus:ring-indigo-300";
    const textColor = disabled ? "text-gray-400 dark:text-slate-500" : "text-gray-900 dark:text-gray-100";

    return (
        <div className={clsx("flex flex-col relative w-full", className)}>
            <div
                className={clsx(
                    "relative flex items-center rounded-xl shadow-sm transition focus-within:ring-2",
                    baseBg,
                    borderColor,
                    sizeMap[size],
                    disabled && "opacity-60 cursor-not-allowed",
                    "overflow-hidden"
                )}
            >
                {prefix && <div className="pl-3 pr-2 flex items-center select-none">{prefix}</div>}

                <select
                    id={id}
                    name={name}
                    ref={ref}
                    disabled={disabled || loading}
                    aria-label={ariaLabel || name}
                    aria-invalid={isInvalid || undefined}
                    aria-describedby={describedByIds.filter(Boolean).join(" ")}
                    value={value}
                    className={clsx(
                        "flex-1 bg-transparent appearance-none outline-none w-full px-3 transition placeholder-gray-400",
                        textColor,
                        "py-0", // height controlled by container
                        !value && placeholder ? "text-gray-500" : ""
                    )}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled hidden>
                            {placeholder}
                        </option>
                    )}
                    {children}
                </select>

                {/* clearable button */}
                {clearable && !disabled && !loading && value && typeof onClear === "function" && (
                    <button
                        type="button"
                        aria-label="Clear selection"
                        onClick={(e) => {
                            e.preventDefault();
                            onClear();
                        }}
                        className="pr-2 pl-1 flex items-center justify-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <svg
                            aria-hidden="true"
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* loading spinner */}
                {loading && (
                    <div className="pr-2 flex items-center">
                        <Loader size="sm" label="" variant="neutral" aria-label="Loading options" />
                    </div>
                )}

                {/* dropdown arrow */}
                <div className="pointer-events-none absolute right-3 flex items-center">
                    <svg
                        className={clsx(
                            "w-4 h-4 transition-transform duration-200",
                            isInvalid
                                ? "text-red-500"
                                : variant === "success"
                                    ? "text-emerald-500"
                                    : "text-gray-400 dark:text-gray-400"
                        )}
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
                    </svg>
                </div>
            </div>

            {/* Help / error text */}
            <div className="mt-1 flex flex-col gap-1">
                {errorMessage ? (
                    <div
                        id={id ? `${id}-error` : undefined}
                        role="alert"
                        className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"
                    >
                        <svg
                            aria-hidden="true"
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4m0 4h.01" />
                        </svg>
                        <span>{errorMessage}</span>
                    </div>
                ) : helpText ? (
                    <div
                        id={id ? `${id}-help` : undefined}
                        className="text-xs text-gray-500 dark:text-slate-400"
                    >
                        {helpText}
                    </div>
                ) : null}
            </div>
        </div>
    );
});

Select.propTypes = {
    className: PropTypes.string,
    variant: PropTypes.oneOf(["default", "error", "success"]),
    size: PropTypes.oneOf(["sm", "md", "lg"]),
    id: PropTypes.string,
    name: PropTypes.string,
    disabled: PropTypes.bool,
    children: PropTypes.node,
    errorMessage: PropTypes.string,
    helpText: PropTypes.string,
    loading: PropTypes.bool,
    prefix: PropTypes.node,
    suffix: PropTypes.node,
    placeholder: PropTypes.string,
    clearable: PropTypes.bool,
    onClear: PropTypes.func,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    "aria-label": PropTypes.string,
};

Select.defaultProps = {
    variant: "default",
    size: "md",
    disabled: false,
    loading: false,
    clearable: false,
    placeholder: "",
};

export default Select;