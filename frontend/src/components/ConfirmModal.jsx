import { useEffect } from "react";

export default function ConfirmModal({
    title = "Confirm",
    description,
    confirmText = "Yes",
    cancelText = "Cancel",
    onConfirm,
    onCancel,
    open = false,
}) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl p-6">
                <div className="flex justify-between items-start">
                    <div className="text-lg font-bold">{title}</div>
                    <button
                        aria-label="close"
                        className="text-gray-400 hover:text-gray-600"
                        onClick={onCancel}
                    >
                        ×
                    </button>
                </div>
                {description && (
                    <div className="mt-2 text-sm text-gray-600">{description}</div>
                )}
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
                        onClick={onCancel}
                    >
                        {cancelText}
                    </button>
                    <button
                        className="px-5 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 font-semibold transition"
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}