import { useEffect, useRef } from "react";

export default function ConfirmModal({
    open,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
}) {
    const modalRef = useRef(null);
    // Focus trap basic
    useEffect(() => {
        if (open) {
            const prev = document.activeElement;
            modalRef.current?.querySelector("button")?.focus();
            return () => prev?.focus();
        }
    }, [open]);

    if (!open) return null;

    const handleKey = (e) => {
        if (e.key === "Escape") onCancel?.();
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onKeyDown={handleKey}
        >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
            <div
                ref={modalRef}
                className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 z-10 flex flex-col gap-4"
            >
                <h2 id="confirm-modal-title" className="text-lg font-bold text-gray-800">
                    {title}
                </h2>
                <p id="confirm-modal-desc" className="text-sm text-gray-600">
                    {description}
                </p>
                <div className="mt-2 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition text-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition text-sm font-semibold"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}