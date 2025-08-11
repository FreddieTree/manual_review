import React, { forwardRef, useId, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid";

function InputImpl(
    {
        className = "",
        variant = "default", // default / error / success
        size = "md", // sm / md / lg
        startAdornment = null, // semantic prefix
        endAdornment = null,   // semantic suffix
        prefix = null,         // legacy
        suffix = null,         // legacy
        clearable = false,
        onClear = () => { },
        loading = false,
        disabled = false,
        errorMessage = "",
        success = false,
        id,
        "aria-label": ariaLabel,
        value,
        ...props
    },
    ref
) {
    const autoId = useId();
    const inputId = id || `input-${autoId}`;

    const innerRef = useRef(null);
    const setRefs = useCallback(
        (node) => {
            innerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref && typeof ref === "object") ref.current = node;
        },
        [ref]
    );

    const isError = Boolean(errorMessage) || variant === "error";
    const showSuccess = (success || variant === "success") && !isError;

    // Size mappings
    const sizeConfig = {
        sm: { height: "h-9", padding: "px-3", text: "text-sm" },
        md: { height: "h-11", padding: "px-4", text: "text-base" },
        lg: { height: "h-12", padding: "px-5", text: "text-lg" },
    };
    const { height, padding, text } = sizeConfig[size] || sizeConfig.md;

    // Container classes
    const containerCls = clsx(
        "relative flex items-center w-full rounded-xl transition-shadow duration-200",
        "bg-white dark:bg-slate-800 shadow-sm",
        disabled && "opacity-60 cursor-not-allowed",
        !disabled && "focus-within:ring-2 focus-within:ring-offset-0",
        isError
            ? "ring-1 ring-red-400"
            : showSuccess
                ? "ring-1 ring-emerald-400"
                : "ring-0"
    );

    // Input base
    const inputCls = clsx(
        "flex-1 bg-transparent outline-none placeholder-gray-400 dark:placeholder-slate-400 transition-colors duration-150",
        padding,
        height,
        text,
        "disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-slate-700",
        "border-none",
        isError ? "text-red-800" : "text-gray-900 dark:text-gray-100"
    );

    // Icon area size
    const iconSize = 20;

    // Right-side status icon (error / success)
    const statusIcon = isError ? (
        <ExclamationCircleIcon
            aria-hidden="true"
            className="text-red-500 ml-2"
            width={iconSize}
            height={iconSize}
        />
    ) : showSuccess ? (
        <CheckCircleIcon
            aria-hidden="true"
            className="text-emerald-500 ml-2"
            width={iconSize}
            height={iconSize}
        />
    ) : null;

    // Clear button shown when applicable
    const showClear =
        clearable && !disabled && !loading && value != null && String(value).length > 0;

    return (
        <div className={clsx("flex flex-col w-full", className)}>
            <div className={containerCls}>
                {/* left adornment / legacy prefix */}
                {(startAdornment || prefix) && (
                    <div className="flex items-center pl-3 pr-2 text-gray-500 select-none">
                        {startAdornment || prefix}
                    </div>
                )}

                <input
                    id={inputId}
                    ref={setRefs}
                    aria-label={ariaLabel}
                    aria-invalid={isError || undefined}
                    aria-describedby={
                        isError
                            ? `${inputId}-error`
                            : showSuccess
                                ? `${inputId}-success`
                                : undefined
                    }
                    aria-busy={loading || undefined}
                    disabled={disabled || loading}
                    className={inputCls}
                    value={value ?? ""}
                    {...props}
                />

                {/* legacy suffix / endAdornment */}
                {(endAdornment || suffix) && (
                    <div className="flex items-center pr-3 pl-2 text-gray-500 select-none">
                        {endAdornment || suffix}
                    </div>
                )}

                {/* status icon */}
                {statusIcon && <div className="flex items-center">{statusIcon}</div>}

                {/* clear button */}
                {showClear && (
                    <button
                        type="button"
                        aria-label="Clear input"
                        onClick={(e) => {
                            e.preventDefault();
                            onClear(e);
                            // 回焦到输入框，符合 Apple 风格的流畅体验
                            requestAnimationFrame(() => innerRef.current?.focus());
                        }}
                        className="flex items-center justify-center p-1 mr-1 text-gray-400 hover:text-gray-600 rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:ring-2 focus-visible:ring-indigo-400"
                        tabIndex={0}
                    >
                        <svg
                            aria-hidden="true"
                            className="w-4 h-4"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 6l8 8M14 6l-8 8" />
                        </svg>
                    </button>
                )}

                {/* loading spinner */}
                {loading && (
                    <div className="flex items-center pr-3">
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* feedback message */}
            {isError && errorMessage && (
                <div
                    id={`${inputId}-error`}
                    className="mt-1 flex items-center gap-2 text-xs text-red-600"
                    role="alert"
                >
                    <ExclamationCircleIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <div>{errorMessage}</div>
                </div>
            )}
            {showSuccess && !isError && (
                <div
                    id={`${inputId}-success`}
                    className="mt-1 flex items-center gap-2 text-xs text-emerald-700"
                    role="status"
                >
                    <CheckCircleIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <div>Looks good</div>
                </div>
            )}
        </div>
    );
}

const Input = forwardRef(InputImpl);

if (process.env.NODE_ENV !== "production") {
    Input.propTypes = {
        variant: PropTypes.oneOf(["default", "error", "success"]),
        size: PropTypes.oneOf(["sm", "md", "lg"]),
        startAdornment: PropTypes.node,
        endAdornment: PropTypes.node,
        prefix: PropTypes.node,
        suffix: PropTypes.node,
        clearable: PropTypes.bool,
        onClear: PropTypes.func,
        loading: PropTypes.bool,
        disabled: PropTypes.bool,
        errorMessage: PropTypes.string,
        success: PropTypes.bool,
        id: PropTypes.string,
        "aria-label": PropTypes.string,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        className: PropTypes.string,
    };
}

export default Input;