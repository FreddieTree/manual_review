// src/components/ConfirmModal.jsx
import React, {
    useEffect,
    useRef,
    useCallback,
    useId,
    useState,
    forwardRef,
    memo,
} from "react";
import PropTypes from "prop-types";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { XMarkIcon } from "@heroicons/react/24/solid";

/** ===== scroll lock with ref-count ===== */
let __lockCount = 0;
let __prevOverflow = "";
function lockScroll() {
    if (typeof document === "undefined") return;
    if (__lockCount === 0) {
        __prevOverflow = document.body.style.overflow || "";
        document.body.style.overflow = "hidden";
    }
    __lockCount++;
}
function unlockScroll() {
    if (typeof document === "undefined") return;
    __lockCount = Math.max(0, __lockCount - 1);
    if (__lockCount === 0) {
        document.body.style.overflow = __prevOverflow || "";
    }
}

function ConfirmModalImpl(
    {
        open,
        title,
        description = "",
        confirmText = "Confirm",
        cancelText = "Cancel",
        onConfirm,
        onCancel,
        intent = "danger", // danger / primary / secondary
        isLoading = false,
        disableEscape = false,
        closeOnBackdrop = true,
        returnFocusRef = null,
        portalContainer,
        role = "alertdialog",
        className = "",
        initialFocusSelector,
    },
    ref
) {
    const dialogId = useId();
    const titleId = `${dialogId}-title`;
    const descId = `${dialogId}-desc`;

    const innerRef = useRef(null);
    const modalRef = /** @type {React.MutableRefObject<HTMLDivElement|null>} */ (
        ref || innerRef
    );
    const lastFocusedRef = useRef(null);
    const [mounted, setMounted] = useState(false);
    const lockedRef = useRef(false);

    // Mount guard for portal
    useEffect(() => {
        setMounted(true);
    }, []);

    // Focus + scroll lock / restore logic
    useEffect(() => {
        if (!mounted) return;

        if (open) {
            // Save prior focus
            lastFocusedRef.current = document.activeElement;

            // Lock scroll once
            if (!lockedRef.current) {
                lockScroll();
                lockedRef.current = true;
            }

            // Focus initial element after render
            const timer = setTimeout(() => {
                const root = modalRef.current;
                if (!root) return;
                let target = null;
                if (initialFocusSelector) {
                    target = root.querySelector(initialFocusSelector);
                }
                if (!target) {
                    target = root.querySelector(
                        'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])'
                    );
                }
                (target || root).focus();
            }, 10);
            return () => clearTimeout(timer);
        } else {
            // Restore focus & unlock scroll
            if (lockedRef.current) {
                unlockScroll();
                lockedRef.current = false;
            }
            if (returnFocusRef?.current) {
                returnFocusRef.current.focus?.();
            } else if (
                lastFocusedRef.current &&
                typeof lastFocusedRef.current.focus === "function"
            ) {
                lastFocusedRef.current.focus();
            }
        }
    }, [open, mounted, initialFocusSelector, returnFocusRef]);

    // Keyboard: Escape, Enter, Tab-trap
    const handleKey = useCallback(
        (e) => {
            if (!open) return;

            if (e.key === "Escape" && !disableEscape) {
                e.preventDefault();
                onCancel?.();
                return;
            }

            if (e.key === "Enter" && !isLoading) {
                if (modalRef.current?.contains(document.activeElement)) {
                    e.preventDefault();
                    onConfirm?.();
                    return;
                }
            }

            if (e.key === "Tab") {
                const root = modalRef.current;
                if (!root) return;
                const focusable = Array.from(
                    root.querySelectorAll(
                        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    )
                ).filter(
                    (el) =>
                        el instanceof HTMLElement &&
                        !el.hasAttribute("disabled") &&
                        el.offsetParent !== null
                );
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
            }
        },
        [open, disableEscape, isLoading, onCancel, onConfirm]
    );

    useEffect(() => {
        if (!open) return;
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, handleKey]);

    const handleBackdropClick = (e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) {
            onCancel?.();
        }
    };

    if (!mounted || !open) return null;

    const container =
        portalContainer ?? (typeof document !== "undefined" ? document.body : null);
    if (!container) return null;

    return createPortal(
        <div
            aria-modal="true"
            role={role}
            aria-labelledby={titleId}
            {...(description ? { "aria-describedby": descId } : {})}
            className={clsx(
                "fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6",
                className
            )}
            data-state="open"
        >
            {/* Backdrop */}
            <div
                aria-hidden="true"
                role="presentation"
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
                aria-busy={isLoading ? "true" : "false"}
            >
                <span
                    tabIndex={0}
                    aria-hidden="true"
                    className="absolute top-0 left-0 w-px h-px opacity-0"
                />
                <div className="absolute top-3 right-3">
                    <button
                        id={`${dialogId}-close`}
                        aria-label="Close"
                        onClick={onCancel}
                        className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <div className="flex-1">
                            <h2
                                id={titleId}
                                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                            >
                                {title}
                            </h2>
                            {description && (
                                <p
                                    id={descId}
                                    className="mt-1 text-sm text-gray-600 dark:text-gray-300"
                                >
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-2 flex flex-wrap justify-end gap-3">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-shrink-0 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm"
                        >
                            {cancelText}
                        </button>
                        <button
                            id={`${dialogId}-confirm`}
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
                <span
                    tabIndex={0}
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 w-px h-px opacity-0"
                />
            </div>

            <style>{`
        @keyframes enter {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-enter { animation: enter 220ms cubic-bezier(0.22,0.08,0.15,1) forwards; }
      `}</style>
        </div>,
        container
    );
}

const ConfirmModal = memo(forwardRef(ConfirmModalImpl));

if (process.env.NODE_ENV !== "production") {
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
        closeOnBackdrop: PropTypes.bool,
        returnFocusRef: PropTypes.shape({ current: PropTypes.any }),
        portalContainer: PropTypes.any,
        role: PropTypes.oneOf(["dialog", "alertdialog"]),
        className: PropTypes.string,
        initialFocusSelector: PropTypes.string,
    };
}

export default ConfirmModal;