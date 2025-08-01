// src/components/ConfirmModal.jsx
import React, { useEffect, useRef, useCallback, useId, useState } from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { XMarkIcon } from "@heroicons/react/24/solid";

/**
 * ConfirmModal with focus trap, accessible labels, backdrop click to dismiss,
 * smooth animations, and optional loading state.
 */
export default function ConfirmModal({
    open,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    intent = "danger", // danger / primary / secondary
    isLoading = false,
    disableEscape = false,
    returnFocusRef = null, // element to restore focus to
}) {
    const dialogId = useId();
    const titleId = `${dialogId}-title`;
    const descId = `${dialogId}-desc`;
    const modalRef = useRef(null);
    const lastFocusedRef = useRef(null);

    const [mounted, setMounted] = useState(false);

    // manage mounting to avoid server mismatch if SSR ever
    useEffect(() => {
        setMounted(true);
    }, []);

    // Save and restore focus
    useEffect(() => {
        if (open) {
            lastFocusedRef.current = document.activeElement;
            // delay to allow animation
            setTimeout(() => {
                // focus first focusable within modal
                const first = modalRef.current?.querySelector(
                    'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                first?.focus();
            }, 10);
            // trap scroll behind
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            if (returnFocusRef?.current) {
                returnFocusRef.current.focus();
            } else if (lastFocusedRef.current) {
                lastFocusedRef.current.focus();
            }
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [open, returnFocusRef]);

    // Key handling: Escape / Enter
    const handleKey = useCallback(
        (e) => {
            if (!open) return;
            if (e.key === "Escape" && !disableEscape) {
                e.preventDefault();
                onCancel?.();
            } else if (e.key === "Enter" && !isLoading) {
                // if focus is inside modal and Enter pressed, trigger confirm if appropriate
                const active = document.activeElement;
                if (modalRef.current?.contains(active)) {
                    e.preventDefault();
                    onConfirm?.();
                }
            }
        },
        [open, onCancel, onConfirm, isLoading, disableEscape]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [handleKey]);

    // Focus trap (simple)
    const handleTab = useCallback((e) => {
        if (e.key !== "Tab") return;
        const focusable = modalRef.current
            ? Array.from(
                modalRef.current.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((el) => el.offsetParent !== null)
            : [];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        const node = modalRef.current;
        const onKeyDown = (e) => {
            if (e.key === "Tab") handleTab(e);
        };
        node?.addEventListener("keydown", onKeyDown);
        return () => node?.removeEventListener("keydown", onKeyDown);
    }, [open, handleTab]);

    // click outside to dismiss
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onCancel?.();
        }
    };

    if (!mounted) return null;
    if (!open) return null;

    return createPortal(
        <div
            aria-modal="true"
            role="alertdialog"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6"
        >
            {/* Backdrop */}
            <div
                aria-hidden="true"
                className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={handleBackdropClick}
            />

            {/* Dialog */}
            <div
                ref={modalRef}
                className={clsx(
                    "relative z-10 w-full max-w-md mx-auto bg-white dark:bg-[#1f2937] rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden transform transition-all duration-300",
                    "scale-95 opacity-0 animate-enter"
                )}
                style={{ animationFillMode: "forwards" }}
            >
                {/* close button */}
                <div className="absolute top-3 right-3">
                    <button
                        aria-label="Close"
                        onClick={onCancel}
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-1">
                            <h2
                                id={titleId}
                                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                            >
                                {title}
                            </h2>
                            <p
                                id={descId}
                                className="mt-1 text-sm text-gray-600 dark:text-gray-300"
                            >
                                {description}
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex flex-wrap justify-end gap-3">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-shrink-0 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={clsx(
                                "flex-shrink-0 flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition",
                                {
                                    "bg-red-600 text-white hover:bg-red-700": intent === "danger",
                                    "bg-indigo-600 text-white hover:bg-indigo-700": intent === "primary",
                                    "bg-slate-600 text-white hover:bg-slate-700": intent === "secondary",
                                    "opacity-70 pointer-events-none": isLoading,
                                }
                            )}
                        >
                            {isLoading && (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            <span>{confirmText}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Inline styles for animation (could be moved to CSS) */}
            <style>{`
        @keyframes enter {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-enter {
          animation: enter 220ms cubic-bezier(0.22, 0.08, 0.15, 1) forwards;
        }
      `}</style>
        </div>,
        document.body
    );
}

ConfirmModal.propTypes = {
    open: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    onConfirm: PropTypes.func,
    onCancel: PropTypes.func,
    intent: PropTypes.oneOf(["danger", "primary", "secondary"]),
    isLoading: PropTypes.bool,
    disableEscape: PropTypes.bool,
    returnFocusRef: PropTypes.shape({ current: PropTypes.any }),
};

ConfirmModal.defaultProps = {
    description: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: () => { },
    onCancel: () => { },
    intent: "danger",
    isLoading: false,
    disableEscape: false,
    returnFocusRef: null,
};