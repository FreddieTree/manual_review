// src/components/ui/CopyButton.jsx
import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import clsx from "clsx";
import Tooltip from "./Tooltip";

// Try-catch import so missing heroicons won't break everything
let ClipboardDocumentIcon = null;
let ClipboardDocumentCheckIcon = null;
try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    ({ ClipboardDocumentIcon, ClipboardDocumentCheckIcon } = require("@heroicons/react/24/solid"));
} catch {
    // fallback inline SVGs if heroicons not present
    ClipboardDocumentIcon = (props) => (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="M6 6h12v14H6z" />
            <path d="M9 12h6" />
            <path d="M9 16h6" />
        </svg>
    );
    ClipboardDocumentCheckIcon = (props) => (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M9 12l2 2l4 -4" />
            <rect x="6" y="6" width="12" height="14" rx="2" />
            <path d="M9 2h6v4H9z" />
        </svg>
    );
}

const STATUS = {
    IDLE: "idle",
    COPIED: "copied",
    ERROR: "error",
};

/**
 * Copy-to-clipboard button with accessible live status, fallback, animations, and tooltip.
 */
export default function CopyButton({
    value = "",
    ariaLabel = "Copy to clipboard",
    size = 5, // governs icon size (rem-based fallback)
    className = "",
    variant = "ghost", // ghost / solid / outline
    duration = 1200, // ms before resetting status
    disabled = false,
}) {
    const [status, setStatus] = useState(STATUS.IDLE);
    const isBusy = status === STATUS.COPIED || status === STATUS.ERROR;

    // attempt copy with fallback
    const doCopy = useCallback(async () => {
        if (!value) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                // fallback: legacy execCommand
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

    // size to tailwind-friendly (fallback use inline style if needed)
    const iconSize = typeof size === "number" ? size : 5;
    const iconClasses = `w-${iconSize} h-${iconSize} flex-shrink-0`;

    // variant styles
    const variantStyles = {
        ghost: "bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800",
        solid: "bg-indigo-600 text-white hover:bg-indigo-700",
        outline: "border border-gray-300 hover:bg-gray-50",
    };

    const isDisabled = disabled || status === STATUS.COPIED;

    return (
        <Tooltip label={tooltipLabel} delay={100}>
            <button
                type="button"
                aria-label={ariaLabel}
                aria-live="polite"
                disabled={isDisabled}
                onClick={() => {
                    if (isDisabled) return;
                    doCopy();
                }}
                className={clsx(
                    "relative flex items-center justify-center rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-400",
                    variantStyles[variant] || variantStyles.ghost,
                    isDisabled && "cursor-not-allowed opacity-70",
                    "p-1",
                    className
                )}
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
                        status === STATUS.ERROR && "shake" // optionally define shake animation in CSS
                    )}
                >
                    {status === STATUS.COPIED ? (
                        <ClipboardDocumentCheckIcon
                            className="text-green-500"
                            style={{ width: iconSize, height: iconSize }}
                            aria-hidden="true"
                        />
                    ) : (
                        <ClipboardDocumentIcon
                            className="text-gray-600"
                            style={{ width: iconSize, height: iconSize }}
                            aria-hidden="true"
                        />
                    )}
                </span>
            </button>
        </Tooltip>
    );
}

CopyButton.propTypes = {
    value: PropTypes.string.isRequired,
    ariaLabel: PropTypes.string,
    size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    className: PropTypes.string,
    variant: PropTypes.oneOf(["ghost", "solid", "outline"]),
    duration: PropTypes.number,
    disabled: PropTypes.bool,
};