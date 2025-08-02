import React, { forwardRef, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import Tooltip from "./Tooltip";
import { ClipboardDocumentIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/solid";

const STATUS = {
    IDLE: "idle",
    COPIED: "copied",
    ERROR: "error",
};

/**
 * Copy-to-clipboard button with accessible live status, fallback, tooltip.
 */
function CopyButtonImpl(
    {
        value = "",
        ariaLabel = "Copy to clipboard",
        size = 16, // icon px size
        className = "",
        variant = "ghost", // ghost / solid / outline
        duration = 1200, // ms before resetting status
        disabled = false,
        ...rest
    },
    ref
) {
    const [status, setStatus] = useState(STATUS.IDLE);
    const isBusy = status === STATUS.COPIED || status === STATUS.ERROR;

    const doCopy = useCallback(async () => {
        if (!value) return;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                // Fallback: legacy execCommand
                const textarea = document.createElement("textarea");
                textarea.value = value;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "absolute";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            setStatus(STATUS.COPIED);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("Copy failed:", e);
            setStatus(STATUS.ERROR);
        }
    }, [value]);

    useEffect(() => {
        if (status === STATUS.IDLE) return;
        const t = setTimeout(() => setStatus(STATUS.IDLE), duration);
        return () => clearTimeout(t);
    }, [status, duration]);

    const tooltipLabel =
        status === STATUS.COPIED
            ? "Copied!"
            : status === STATUS.ERROR
                ? "Failed to copy"
                : "Copy to clipboard";

    const variantStyles = {
        ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-white/10",
        solid: "bg-indigo-600 text-white hover:bg-indigo-700",
        outline: "border border-gray-300 hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/5",
    };

    const isDisabled = disabled || status === STATUS.COPIED;

    return (
        <Tooltip label={tooltipLabel} delay={100}>
            <button
                ref={ref}
                type="button"
                aria-label={ariaLabel}
                aria-live="polite"
                aria-busy={isBusy || undefined}
                disabled={isDisabled}
                onClick={() => {
                    if (!isDisabled) doCopy();
                }}
                className={clsx(
                    "relative flex items-center justify-center rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-400",
                    variantStyles[variant] || variantStyles.ghost,
                    isDisabled && "cursor-not-allowed opacity-70",
                    "p-1.5",
                    className
                )}
                {...rest}
            >
                {/* Visually hidden live status for screen readers */}
                <span className="sr-only">
                    {status === STATUS.COPIED
                        ? "Copied to clipboard"
                        : status === STATUS.ERROR
                            ? "Copy failed"
                            : ""}
                </span>

                <span
                    className={clsx(
                        "flex items-center justify-center transition-transform",
                        status === STATUS.COPIED && "scale-110",
                        status === STATUS.ERROR && "animate-pulse"
                    )}
                    aria-hidden="true"
                >
                    {status === STATUS.COPIED ? (
                        <ClipboardDocumentCheckIcon style={{ width: size, height: size }} className="text-emerald-500" />
                    ) : (
                        <ClipboardDocumentIcon style={{ width: size, height: size }} className="text-gray-600 dark:text-gray-300" />
                    )}
                </span>
            </button>
        </Tooltip>
    );
}

if (process.env.NODE_ENV !== "production") {
    CopyButtonImpl.propTypes = {
        value: PropTypes.string.isRequired,
        ariaLabel: PropTypes.string,
        size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        className: PropTypes.string,
        variant: PropTypes.oneOf(["ghost", "solid", "outline"]),
        duration: PropTypes.number,
        disabled: PropTypes.bool,
    };
}

const CopyButton = forwardRef(CopyButtonImpl);
export default CopyButton;